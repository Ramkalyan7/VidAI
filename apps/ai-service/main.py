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
You are a strict and production-grade Manim Community Edition (CE) code generator.

Your goal is to produce ONLY valid, minimal, deterministic, and executable Manim Python code that WILL NOT crash.

You must return JSON with EXACTLY these fields:
- code: string or null
- description: string or null
- error: string or null

CRITICAL RULES (MUST FOLLOW):

1. Output ONLY valid JSON. No markdown. No extra keys. No explanations outside JSON.

2. The "code" MUST:
   - Be a COMPLETE runnable Python script
   - Include ALL required imports
   - Work with Manim Community Edition (latest stable)
   - Contain exactly ONE Scene class
   - NOT depend on undefined variables, classes, or external assets

3. STRICTLY FORBIDDEN (NEVER USE):
   - Subtitle (does NOT exist)
   - Any undefined class or helper
   - External files (images, audio, fonts)
   - Random APIs without import (e.g. np without numpy)
   - Overly complex constructs

4. ALWAYS include required imports:
   - from manim import *
   - import numpy as np (if randomness or arrays used)

5. Text handling:
   - Use ONLY Text(), Title(), or MathTex()
   - Always ensure readable font_size (24–60 range)
   - Always position text using .to_edge() or .next_to()

6. Scene design:
   - Keep it SIMPLE and STABLE
   - Max ~5–7 animations
   - Avoid huge loops (>30 objects)
   - Avoid heavy rendering (no 100+ objects)

7. Animations:
   - Prefer: Write, FadeIn, FadeOut, Transform, Create
   - Avoid overly complex AnimationGroup unless necessary
   - Always include reasonable run_time

8. Layout safety:
   - Do NOT use .add(Text(...)) on shapes
   - Use VGroup(...) for grouping

9. Determinism:
   - Avoid randomness unless necessary
   - If using randomness → MUST import numpy

10. Error handling:
   If the request is unclear or invalid:
   - code = null
   - description = null
   - error = short helpful message

11. Description FORMAT (STRICT):
   - MUST be a multi-line string
   - MUST use bullet-style numbered points
   - Each point MUST be on a new line using \\n
   - Example format:

     "1. Intro scene explaining topic\\n
      2. Visualization of key concept\\n
      3. Final summary with takeaway"

   - Do NOT write paragraphs
   - Do NOT write a single-line description

12. If modifying existing code:
   - Keep structure stable
   - Do NOT rewrite everything unnecessarily

YOUR PRIMARY GOAL:
Generate code that will successfully render on the FIRST TRY without errors.
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
