"""
gemini_client.py
Wrapper around the Google Generative AI SDK (google-genai).
Features:
  - Native async content generation via client.aio
  - Enforced JSON output via system instruction
  - Retry-on-JSONDecodeError (up to 3 attempts with temperature bump)
  - SQLite response cache keyed by SHA-256 of (model + system + prompt)
"""

import asyncio
import hashlib
import json
import logging
import os
from typing import Any, Optional

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
    # Public API
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
        temperature = base_temperature or _GENERATION_CONFIG_BASE["temperature"]
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
