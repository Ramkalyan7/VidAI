from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, model_validator
from dotenv import load_dotenv

load_dotenv()

DEFAULT_MODEL = "gemini-2.5-flash"
SYSTEM_INSTRUCTION = """
You are an elite Manim Community Edition video engineer.
Your only job is to produce high-quality Manim Python code for the user's requested video.

You must always return structured JSON with exactly these fields:
- "code": a complete runnable Manim Python script as a string, or null
- "description": a string, or null
- "error": a string, or null

Rules:
1. Output valid JSON only. Do not use markdown fences. Do not add any extra keys.
2. If the request is meaningful and has enough context, set "error" to null and return valid values for "code" and "description".
3. The "code" field must contain complete executable Manim code with all required imports.
4. The code should aim for the best possible video quality for the user's prompt: strong visual pacing, clear animations, sensible colors, readable text, and polished scene transitions.
5. If the conversation is requesting a brand new video, "description" must describe the generated video.
6. If the conversation is requesting changes to an existing video/code, "description" must summarize the changes made in this version.
7. If the user's latest request is gibberish, meaningless, too vague, or missing enough context to produce a good Manim video, set "code" to null, "description" to null, and put a short helpful explanation in "error" telling the user to provide a clearer prompt.
8. If earlier messages include existing code, preserve useful parts where appropriate and modify them carefully instead of rewriting thoughtlessly.
9. Stay strictly focused on Manim video generation. Do not answer unrelated questions.
10. Prefer clean, maintainable scene code and deterministic behavior.
""".strip()


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class NextConversationRequest(BaseModel):
    conversation: list[ChatMessage] = Field(min_length=1)
    model: str = DEFAULT_MODEL
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)


class ManimGeneration(BaseModel):
    code: str | None = None
    description: str | None = None
    error: str | None = None

    @model_validator(mode="after")
    def validate_shape(self) -> "ManimGeneration":
        has_generation = bool(self.code and self.description)
        has_error = bool(self.error)

        if has_generation == has_error:
            raise ValueError("Response must contain either code+description or error")

        return self


class NextConversationResponse(BaseModel):
    model: str
    output: ManimGeneration


@lru_cache(maxsize=1)
def get_gemini_client() -> Any:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=api_key)


def build_prompt(conversation: list[ChatMessage]) -> str:
    lines = [f"[SYSTEM]\n{SYSTEM_INSTRUCTION}"]
    for msg in conversation:
        lines.append(f"[{msg.role.upper()}]\n{msg.content}")
    lines.append(
        "[ASSISTANT]\nReturn the next response as valid JSON with exactly three fields: code, description, and error."
    )
    return "\n\n".join(lines)


app = FastAPI(title="ai-service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/conversation/next", response_model=NextConversationResponse)
def next_conversation_turn(payload: NextConversationRequest) -> NextConversationResponse:
    prompt = build_prompt(payload.conversation)

    try:
        client = get_gemini_client()
        response = client.models.generate_content(
            model=payload.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=payload.temperature,
                response_mime_type="application/json",
            ),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}") from exc

    response_text = (getattr(response, "text", None) or "").strip()
    if not response_text:
        raise HTTPException(status_code=502, detail="Gemini returned an empty response")

    try:
        parsed_output = ManimGeneration.model_validate(json.loads(response_text))
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Gemini returned invalid structured output: {exc}") from exc

    return NextConversationResponse(
        model=payload.model,
        output=parsed_output,
    )
