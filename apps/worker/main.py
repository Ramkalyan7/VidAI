from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask
from dotenv import load_dotenv

load_dotenv()


app = FastAPI(title="worker", version="0.1.0")


class RenderRequest(BaseModel):
    project_id: str = Field(
        min_length=1,
        description="Project id used for storage pathing",
    )
    code: str = Field(min_length=1, description="Manim Python script")
    scene: str | None = Field(
        default=None, description="Optional scene class name to render (e.g. 'MainScene')"
    )
    quality: Literal["low", "medium", "high", "4k"] = Field(default="medium")
    fps: int | None = Field(default=None, ge=1, le=120)


@dataclass(frozen=True)
class RenderResult:
    video_path: Path
    work_dir: Path


def _timeout_seconds() -> int:
    raw = os.getenv("RENDER_TIMEOUT_SEC")
    if not raw:
        return 180
    try:
        value = int(raw)
        return value if value > 0 else 180
    except ValueError:
        return 180


def _detect_first_scene_class(code: str) -> str | None:
    # Best-effort heuristic: find the first class inheriting from Scene / MovingCameraScene / ThreeDScene, etc.
    match = re.search(r"^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*.*Scene.*\)\s*:", code, re.M)
    return match.group(1) if match else None


def _quality_flag(quality: str) -> str:
    return {
        "low": "-ql",
        "medium": "-qm",
        "high": "-qh",
        "4k": "-qk",
    }.get(quality, "-qm")


def _find_latest_mp4(work_dir: Path) -> Path | None:
    mp4s = list(work_dir.rglob("*.mp4"))
    if not mp4s:
        return None
    return max(mp4s, key=lambda p: p.stat().st_mtime)


def _get_s3_bucket() -> str:
    bucket = os.getenv("AWS_S3_BUCKET").strip()
    if not bucket:
        raise HTTPException(
            status_code=500,
            detail="S3 bucket is not configured. Set `S3_BUCKET` or `AWS_S3_BUCKET`.",
        )
    return bucket


def _get_aws_region() -> str:
    region= os.getenv("AWS_REGION").strip()
    if not region:
        raise HTTPException(
            status_code=500,
            detail="AWS region is not configured. Set `AWS_REGION`",
        )    
    return region


def _upload_video_to_s3(video_path: Path, project_id: str) -> None:
    bucket = _get_s3_bucket()
    region = _get_aws_region()
    s3_key = f"videos/{project_id}.mp4"

    try:
        boto3.client("s3", region_name=region).upload_file(
            str(video_path),
            bucket,
            s3_key,
            ExtraArgs={"ContentType": "video/mp4"},
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(status_code=502, detail=f"Failed to upload video to S3: {exc}") from exc


def render_manim_to_video(payload: RenderRequest) -> RenderResult:
    job_id = uuid.uuid4().hex[:12]
    base_dir = Path(tempfile.mkdtemp(prefix=f"worker_{job_id}_"))
    script_path = base_dir / "scene.py"
    script_path.write_text(payload.code, encoding="utf-8")

    scene_name = payload.scene or _detect_first_scene_class(payload.code)
    if not scene_name:
        shutil.rmtree(base_dir, ignore_errors=True)
        raise HTTPException(
            status_code=400,
            detail="No scene class found. Provide `scene` (class name) or include a Scene subclass in `code`.",
        )

    media_dir = base_dir / "media"
    media_dir.mkdir(parents=True, exist_ok=True)

    cmd: list[str] = [
        sys.executable,
        "-m",
        "manim",
        str(script_path),
        scene_name,
        _quality_flag(payload.quality),
        "--format",
        "mp4",
        "--media_dir",
        str(media_dir),
        "--progress_bar",
        "none",
        "--disable_caching",
    ]

    if payload.fps is not None:
        cmd.extend(["--fps", str(payload.fps)])


    try:
        subprocess.run(
            cmd,
            cwd=str(base_dir),
            check=True,
            capture_output=True,
            text=True,
            timeout=_timeout_seconds(),
            env={
                **os.environ,
                "PYTHONDONTWRITEBYTECODE": "1",
                "PYTHONNOUSERSITE": "1",
            },
        )
    except subprocess.TimeoutExpired as exc:
        shutil.rmtree(base_dir, ignore_errors=True)
        raise HTTPException(status_code=408, detail=f"Render timed out after {_timeout_seconds()}s") from exc
    except subprocess.CalledProcessError as exc:
        shutil.rmtree(base_dir, ignore_errors=True)
        stderr = (exc.stderr or "").strip()
        stdout = (exc.stdout or "").strip()
        detail = "\n".join([line for line in [stderr, stdout] if line])[-6000:]
        raise HTTPException(status_code=422, detail=f"Manim render failed:\n{detail}") from exc

    video_path = _find_latest_mp4(media_dir) or _find_latest_mp4(base_dir)
    if not video_path or not video_path.exists():
        shutil.rmtree(base_dir, ignore_errors=True)
        raise HTTPException(status_code=502, detail="Render completed but no .mp4 was produced")

    _upload_video_to_s3(video_path, payload.project_id)

    return RenderResult(
        video_path=video_path,
        work_dir=base_dir,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/render")
def render(payload: RenderRequest) -> dict:
    result = render_manim_to_video(payload)

    # Cleanup immediately after processing
    shutil.rmtree(result.work_dir, ignore_errors=True)

    return {
        "status": "success",
        "message": "Video rendered and uploaded successfully",
        "project_id": payload.project_id
    }
