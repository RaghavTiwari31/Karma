#!/usr/bin/env python3
"""
test_gemini.py — Quick smoke test for the Gemini client.
Run this BEFORE starting the main FastAPI server to confirm the API key works.

Usage:
    cd "d:/Hackathon Resources/ET GenAI/karma"
    python test_gemini.py
"""

import asyncio
import os
import sys
import json

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from backend.ai.gemini_client import GeminiClient


async def main():
    print("=" * 60)
    print("  KARMA — Gemini Client Smoke Test")
    print("=" * 60)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        print("\n❌  ERROR: GEMINI_API_KEY is not set in your .env file.")
        print("   Edit karma/.env and replace 'your_gemini_api_key_here'")
        print("   with your actual Gemini API key from:")
        print("   https://aistudio.google.com/app/apikey")
        sys.exit(1)

    print(f"\n✅  API key found (length: {len(api_key)} chars)")

    client = GeminiClient()

    print("\n📡  Calling Gemini API...")
    try:
        result = await client.generate_json(
            prompt=(
                "Return a JSON object with exactly three keys:\n"
                "1. 'status' — value must be 'ok'\n"
                "2. 'message' — a one-sentence description of what KARMA does\n"
                "3. 'test_number' — the integer 42"
            ),
            system_instruction=(
                "You are KARMA's test assistant. "
                "Always respond with valid JSON only."
            ),
            use_cache=False,
        )
        print("\n✅  Gemini responded successfully!")
        print("\n📄  Response JSON:")
        print(json.dumps(result, indent=2))
        assert result.get("status") == "ok", "Expected status=='ok'"
        assert result.get("test_number") == 42, "Expected test_number==42"
        print("\n✅  All assertions passed. Gemini integration is working!\n")
    except Exception as e:
        print(f"\n❌  Gemini call failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
