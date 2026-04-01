from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class RenderRequest(BaseModel):
    project_id: str = Field(min_length=1, description="Project id used for storage pathing")
    code: str = Field(min_length=1, description="Manim Python script")
    scene: str | None = Field(default=None, description="Optional scene class name to render")
    quality: Literal["low", "medium", "high", "4k"] = Field(default="medium")
    fps: int | None = Field(default=None, ge=1, le=120)


class QueuedRenderRequest(RenderRequest):
    attempt: int = Field(default=0, ge=0)
    queued_at: str | None = None
    last_error: str | None = None


@dataclass(frozen=True)
class RenderResult:
    video_path: Path
    work_dir: Path
