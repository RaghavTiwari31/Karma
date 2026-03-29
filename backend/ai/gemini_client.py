"""
gemini_client.py
Wrapper around the Google Generative AI SDK (google-genai).
Features:
  - Native async content generation via client.aio
  - Enforced JSON output via system instruction
  - Retry-on-JSONDecodeError (up to 3 attempts with temperature bump)
  - SQLite response cache keyed by SHA-256 of (model + system + prompt)
  - Function Calling support for agentic tool use
"""

import asyncio
import hashlib
import json
import logging
import os
from typing import Any, Callable, Optional

from google import genai
from google.genai import types
from google.genai.errors import ClientError
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "gemini-2.5-flash"
_FALLBACK_MODEL = "gemini-2.0-flash-lite"   # fast lite model when primary hits quota
_MAX_RETRIES = 3
_API_TIMEOUT_SECONDS = 30  # hard timeout per API call to avoid hangs
_GENERATION_CONFIG_BASE = {
    "temperature": 0.2,
    "top_p": 0.95,
    "max_output_tokens": 4096,
    "response_mime_type": "application/json",
}


class GeminiClient:
    """
    Singleton-style client. Initialise once at app startup and inject everywhere.
    Now uses the new google-genai SDK with gemini-2.0-flash.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: str = _DEFAULT_MODEL):
        key = api_key or os.getenv("GEMINI_API_KEY")
        if not key:
            raise EnvironmentError("GEMINI_API_KEY is not set. Add it to your .env file.")
        
        self.client = genai.Client(api_key=key)
        self.model_name = model_name
        self._db = None  # injected after DB initialisation
        self._semaphore = asyncio.Semaphore(1)  # Stricter concurrency for Free Tier
        logger.info(f"GeminiClient initialised with model: {model_name} (concurrency: 1)")

    # ------------------------------------------------------------------
    # Public API: JSON generation (used by all agents)
    # ------------------------------------------------------------------

    async def generate_json(
        self,
        prompt: str,
        system_instruction: str,
        *,
        temperature: Optional[float] = None,
        use_cache: bool = True,
    ) -> dict[str, Any]:
        """
        Main entry point. Returns a parsed JSON dict.
        Raises ValueError if all retries produce invalid JSON.
        """
        cache_key = self._cache_key(system_instruction, prompt)

        if use_cache and self._db is not None:
            cached = await self._db.get_cached_response(cache_key)
            if cached:
                logger.debug("Cache hit for key %s", cache_key[:12])
                return cached

        result = await self._generate_with_retry(prompt, system_instruction, temperature)

        if use_cache and self._db is not None:
            await self._db.set_cached_response(cache_key, result)

        return result

    # ------------------------------------------------------------------
    # Public API: Function Calling (agentic tool use)
    # ------------------------------------------------------------------

    async def generate_with_tools(
        self,
        prompt: str,
        system_instruction: str,
        tool_declarations: list[dict],
        tool_handlers: dict[str, Callable],
        *,
        max_tool_rounds: int = 5,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        """
        Agentic function calling: Gemini decides which tools to call,
        we execute them, feed results back, and Gemini produces final analysis.

        Args:
            prompt: The user's request
            system_instruction: System prompt
            tool_declarations: List of function declaration dicts
            tool_handlers: Map of function_name -> async callable
            max_tool_rounds: Max back-and-forth rounds with Gemini
            temperature: Generation temperature

        Returns:
            dict with 'analysis' (final JSON) and 'tool_trace' (list of tool calls made)
        """
        # Build tool declarations for the SDK
        function_declarations = []
        for decl in tool_declarations:
            # Build properties schema
            props = {}
            required = []
            for param_name, param_info in decl.get("parameters", {}).items():
                props[param_name] = types.Schema(
                    type=types.Type.STRING,
                    description=param_info.get("description", ""),
                )
                if param_info.get("required", False):
                    required.append(param_name)

            function_declarations.append(types.FunctionDeclaration(
                name=decl["name"],
                description=decl["description"],
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties=props,
                    required=required if required else None,
                ),
            ))

        tools = [types.Tool(function_declarations=function_declarations)]

        # Initial request with tools
        config = types.GenerateContentConfig(
            system_instruction=system_instruction + (
                "\n\nIMPORTANT: Use the provided tools to gather data before making recommendations. "
                "Call the relevant tools first, then provide your final analysis as valid JSON."
            ),
            tools=tools,
            temperature=temperature,
        )

        contents = [types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)]
        )]

        tool_trace = []  # Track which tools Gemini called

        loop = asyncio.get_event_loop()

        for round_num in range(max_tool_rounds):
            # Call Gemini
            response = await loop.run_in_executor(
                None,
                lambda: self.client.models.generate_content(
                    model=self.model_name,
                    contents=contents,
                    config=config,
                )
            )

            # Check if Gemini wants to call a function
            candidate = response.candidates[0]
            parts = candidate.content.parts

            function_calls = [p for p in parts if p.function_call is not None]

            if not function_calls:
                # No more tool calls — Gemini is giving its final answer
                final_text = "".join(p.text for p in parts if p.text)
                logger.info(
                    "Function calling complete: %d tools used in %d rounds",
                    len(tool_trace), round_num + 1,
                )
                break

            # Execute each function call
            function_responses = []
            for part in function_calls:
                fn_call = part.function_call
                fn_name = fn_call.name
                fn_args = dict(fn_call.args) if fn_call.args else {}

                logger.info("Gemini → tool call: %s(%s)", fn_name, fn_args)

                # Execute the handler
                handler = tool_handlers.get(fn_name)
                if handler:
                    try:
                        result = await handler(**fn_args)
                        tool_trace.append({
                            "tool": fn_name,
                            "args": fn_args,
                            "result_summary": str(result)[:200],
                            "status": "success",
                        })
                    except Exception as e:
                        logger.warning("Tool %s failed: %s", fn_name, e)
                        result = {"error": str(e)}
                        tool_trace.append({
                            "tool": fn_name,
                            "args": fn_args,
                            "status": "error",
                            "error": str(e),
                        })
                else:
                    result = {"error": f"Unknown tool: {fn_name}"}
                    tool_trace.append({
                        "tool": fn_name,
                        "args": fn_args,
                        "status": "not_found",
                    })

                function_responses.append(types.Part.from_function_response(
                    name=fn_name,
                    response={"result": result},
                ))

            # Add Gemini's function call + our responses to conversation
            contents.append(candidate.content)
            contents.append(types.Content(
                role="user",
                parts=function_responses,
            ))
        else:
            # Hit max rounds without a final answer
            final_text = "{}"
            logger.warning("Function calling hit max rounds (%d)", max_tool_rounds)

        # Parse the final JSON response
        try:
            analysis = self._parse_json(final_text)
        except (json.JSONDecodeError, ValueError):
            logger.warning("Function calling final response not JSON, retrying with JSON enforcement")
            # One more call asking for JSON specifically
            contents.append(types.Content(
                role="user",
                parts=[types.Part.from_text(
                    text="Now provide your final analysis as a valid JSON object. No markdown, no fences."
                )]
            ))
            json_config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=temperature,
                response_mime_type="application/json",
            )
            response = await loop.run_in_executor(
                None,
                lambda: self.client.models.generate_content(
                    model=self.model_name,
                    contents=contents,
                    config=json_config,
                )
            )
            final_text = response.text
            analysis = self._parse_json(final_text)

        return {
            "analysis": analysis,
            "tool_trace": tool_trace,
        }

    def set_db(self, db) -> None:
        """Inject the DB instance after startup so caching works."""
        self._db = db

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _generate_with_retry(
        self,
        prompt: str,
        system_instruction: str,
        base_temperature: Optional[float],
    ) -> dict[str, Any]:
        temperature = base_temperature or 0.2
        last_error: Optional[Exception] = None
        current_model = self.model_name
        used_fallback = False

        for attempt in range(1, _MAX_RETRIES + 2):  # allow one extra attempt for fallback
            try:
                # Use global semaphore to avoid 429s during parallel tasks
                async with self._semaphore:
                    raw_text = await asyncio.wait_for(
                        self._call_api(prompt, system_instruction, temperature, model_override=current_model),
                        timeout=_API_TIMEOUT_SECONDS,
                    )
                return self._parse_json(raw_text)

            except asyncio.TimeoutError:
                logger.warning(
                    "Gemini API timeout after %ds on model %s (attempt %d)",
                    _API_TIMEOUT_SECONDS, current_model, attempt,
                )
                if not used_fallback:
                    logger.info("Switching to fallback model: %s", _FALLBACK_MODEL)
                    current_model = _FALLBACK_MODEL
                    used_fallback = True
                    continue
                last_error = asyncio.TimeoutError(f"Timeout after {_API_TIMEOUT_SECONDS}s")

            except ClientError as exc:
                if "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc):
                    if not used_fallback:
                        logger.info(
                            "Gemini quota exhausted on %s. Falling back to %s...",
                            current_model, _FALLBACK_MODEL,
                        )
                        current_model = _FALLBACK_MODEL
                        used_fallback = True
                        await asyncio.sleep(1)
                        continue

                    wait_time = 5 * attempt
                    logger.warning(
                        "Gemini Rate Limit (429) on fallback %s too. Waiting %ds (attempt %d)...",
                        current_model, wait_time, attempt,
                    )
                    await asyncio.sleep(wait_time)
                    last_error = exc
                    continue
                raise exc

            except json.JSONDecodeError as exc:
                logger.warning(
                    "Attempt %d: JSONDecodeError. Temperature bumped. Error: %s",
                    attempt, exc,
                )
                last_error = exc
                temperature = min(temperature + 0.15, 1.0)

        raise ValueError(
            f"Gemini failed after retries and fallback. Last model: {current_model}. Error: {last_error}"
        )

    async def _call_api(self, prompt: str, system_instruction: str, temperature: float, model_override: Optional[str] = None) -> str:
        """Runs the asynchronous Gemini SDK call."""
        model = model_override or self.model_name

        config_kwargs: dict = dict(
            temperature=temperature,
            top_p=_GENERATION_CONFIG_BASE["top_p"],
            max_output_tokens=_GENERATION_CONFIG_BASE["max_output_tokens"],
            response_mime_type=_GENERATION_CONFIG_BASE["response_mime_type"],
            system_instruction=(
                system_instruction
                + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, "
                "no preamble, no trailing text."
            ),
        )

        # Disable thinking mode on gemini-2.5-* to prevent long hangs on complex prompts.
        # Thinking is great for quality but incompatible with our <4s latency target.
        if "2.5" in model:
            try:
                config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
            except AttributeError:
                pass  # older SDK versions don't have ThinkingConfig — safe to ignore

        config = types.GenerateContentConfig(**config_kwargs)

        response = await self.client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
        )
        return response.text

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any]:
        """Strip accidental markdown fences if present, then parse."""
        text = text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            # drop first and last fence lines
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        return json.loads(text)

    @staticmethod
    def _cache_key(system: str, prompt: str) -> str:
        payload = f"{system}|||{prompt}"
        return hashlib.sha256(payload.encode()).hexdigest()
