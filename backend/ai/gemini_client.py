"""
gemini_client.py
Wrapper around the Google Generative AI SDK.
Features:
  - Async content generation via run_in_executor (SDK is sync)
  - Enforced JSON output via system instruction
  - Retry-on-JSONDecodeError (up to 3 attempts with temperature bump)
  - SQLite response cache keyed by SHA-256 of (model + system + prompt)
"""

import asyncio
import hashlib
import json
import logging
import os
from functools import partial
from typing import Any, Optional

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "gemini-2.0-flash-lite"
_MAX_RETRIES = 3
_GENERATION_CONFIG_BASE = {
    "temperature": 0.2,
    "top_p": 0.95,
    "max_output_tokens": 2048,
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
        genai.configure(api_key=key)
        self.model_name = model_name
        self._db = None  # injected after DB initialisation
        logger.info(f"GeminiClient initialised with model: {model_name}")

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

        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                raw_text = await self._call_api(prompt, system_instruction, temperature)
                return self._parse_json(raw_text)
            except json.JSONDecodeError as exc:
                logger.warning(
                    "Attempt %d/%d: JSONDecodeError — bumping temperature. Error: %s",
                    attempt, _MAX_RETRIES, exc,
                )
                last_error = exc
                temperature = min(temperature + 0.15, 1.0)

        raise ValueError(
            f"Gemini returned invalid JSON after {_MAX_RETRIES} attempts. "
            f"Last error: {last_error}"
        )

    async def _call_api(self, prompt: str, system_instruction: str, temperature: float) -> str:
        """Runs the synchronous Gemini SDK call in a thread pool."""
        generation_config = {**_GENERATION_CONFIG_BASE, "temperature": temperature}
        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=(
                system_instruction
                + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, "
                "no preamble, no trailing text."
            ),
            generation_config=generation_config,
        )
        loop = asyncio.get_event_loop()
        fn = partial(model.generate_content, prompt)
        response = await loop.run_in_executor(None, fn)
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
