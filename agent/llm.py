import os
from google import genai
from google.genai import types


def _make_config(system=None, max_tokens: int = 2048) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        max_output_tokens=max_tokens,
        system_instruction=system,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )


def call_llm(model: str, user: str, system=None, max_tokens: int = 2048) -> str:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = client.models.generate_content(
        model=model,
        contents=user,
        config=_make_config(system, max_tokens),
    )
    return response.text.strip()
