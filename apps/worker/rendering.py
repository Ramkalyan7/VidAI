from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException

from config import (
    MAX_RENDER_ERROR_DETAIL_LENGTH,
    aws_region,
    render_timeout_seconds,
    s3_bucket,
)
from models import RenderRequest, RenderResult


def extract_error_message(exc: Exception) -> str:
    if isinstance(exc, HTTPException):
        detail = exc.detail
        return detail if isinstance(detail, str) else str(detail)
    return str(exc) or exc.__class__.__name__


def detect_first_scene_class(code: str) -> str | None:
    match = re.search(r"^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*.*Scene.*\)\s*:", code, re.M)
    return match.group(1) if match else None


def quality_flag(quality: str) -> str:
    return {
        "low": "-ql",
        "medium": "-qm",
        "high": "-qh",
        "4k": "-qk",
    }.get(quality, "-qm")


def find_latest_mp4(work_dir: Path) -> Path | None:
    mp4s = list(work_dir.rglob("*.mp4"))
    if not mp4s:
        return None
    return max(mp4s, key=lambda path: path.stat().st_mtime)


def build_manim_command(
    script_path: Path,
    scene_name: str,
    media_dir: Path,
    quality: str,
    fps: int | None,
) -> list[str]:
    command = [
        sys.executable,
        "-m",
        "manim",
        str(script_path),
        scene_name,
        quality_flag(quality),
        "--format",
        "mp4",
        "--media_dir",
        str(media_dir),
        "--progress_bar",
        "none",
        "--disable_caching",
    ]

    if fps is not None:
        command.extend(["--fps", str(fps)])

    return command


def run_manim_render(command: list[str], work_dir: Path) -> None:
    try:
        subprocess.run(
            command,
            cwd=str(work_dir),
            check=True,
            capture_output=True,
            text=True,
            timeout=render_timeout_seconds(),
            env={
                **os.environ,
                "PYTHONDONTWRITEBYTECODE": "1",
                "PYTHONNOUSERSITE": "1",
            },
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(
            status_code=408,
            detail=f"Render timed out after {render_timeout_seconds()}s",
        ) from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        stdout = (exc.stdout or "").strip()
        detail = "\n".join(line for line in [stderr, stdout] if line)[-MAX_RENDER_ERROR_DETAIL_LENGTH:]
        raise HTTPException(status_code=422, detail=f"Manim render failed:\n{detail}") from exc


def upload_video_to_s3(video_path: Path, project_id: str) -> None:
    try:
        boto3.client("s3", region_name=aws_region()).upload_file(
            str(video_path),
            s3_bucket(),
            f"videos/{project_id}.mp4",
            ExtraArgs={"ContentType": "video/mp4"},
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(status_code=502, detail=f"Failed to upload video to S3: {exc}") from exc


def render_manim_to_video(payload: RenderRequest) -> RenderResult:
    job_id = uuid.uuid4().hex[:12]
    work_dir = Path(tempfile.mkdtemp(prefix=f"worker_{job_id}_"))
    script_path = work_dir / "scene.py"
    script_path.write_text(payload.code, encoding="utf-8")

    scene_name = payload.scene or detect_first_scene_class(payload.code)
    if not scene_name:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(
            status_code=400,
            detail="No scene class found. Provide `scene` (class name) or include a Scene subclass in `code`.",
        )

    media_dir = work_dir / "media"
    media_dir.mkdir(parents=True, exist_ok=True)

    try:
        command = build_manim_command(
            script_path=script_path,
            scene_name=scene_name,
            media_dir=media_dir,
            quality=payload.quality,
            fps=payload.fps,
        )
        run_manim_render(command, work_dir)

        video_path = find_latest_mp4(media_dir) or find_latest_mp4(work_dir)
        if not video_path or not video_path.exists():
            raise HTTPException(status_code=502, detail="Render completed but no .mp4 was produced")

        upload_video_to_s3(video_path, payload.project_id)
        return RenderResult(video_path=video_path, work_dir=work_dir)
    except Exception:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise
