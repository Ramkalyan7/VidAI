from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from urllib import error as urllib_error
from urllib import request as urllib_request

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()


app = FastAPI(title="worker", version="0.1.0")
_consumer_thread: threading.Thread | None = None
_consumer_stop_event = threading.Event()


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


class QueuedRenderRequest(RenderRequest):
    attempt: int = Field(default=0, ge=0)
    queued_at: str | None = None
    last_error: str | None = None


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


def _queue_poll_interval_seconds() -> float:
    raw = os.getenv("RENDER_QUEUE_POLL_INTERVAL_SEC")
    if not raw:
        return 5.0
    try:
        value = float(raw)
        return value if value > 0 else 5.0
    except ValueError:
        return 5.0


def _queue_name() -> str:
    return os.getenv("RENDER_QUEUE_NAME", "render:jobs").strip() or "render:jobs"


def _processing_queue_name() -> str:
    return f"{_queue_name()}:processing"


def _dead_letter_queue_name() -> str:
    return f"{_queue_name()}:dead"


def _max_job_attempts() -> int:
    raw = os.getenv("RENDER_QUEUE_MAX_ATTEMPTS")
    if not raw:
        return 3
    try:
        value = int(raw)
        return value if value > 0 else 3
    except ValueError:
        return 3


def _api_callback_url() -> str:
    return (
        os.getenv("API_RENDER_CALLBACK_URL", "http://localhost:5000/internal/worker/render-status")
        .strip()
    )


def _worker_callback_token() -> str | None:
    token = os.getenv("WORKER_CALLBACK_TOKEN")
    if not token:
        return None
    return token.strip() or None


def _consumer_enabled() -> bool:
    value = os.getenv("RENDER_QUEUE_CONSUMER_ENABLED", "true").strip().lower()
    return value not in {"0", "false", "no", "off"}


def _upstash_rest_url() -> str:
    value = os.getenv("UPSTASH_REDIS_REST_URL", "").strip()
    if not value:
        raise RuntimeError("UPSTASH_REDIS_REST_URL is not configured")
    return value.rstrip("/")


def _upstash_rest_token() -> str:
    value = os.getenv("UPSTASH_REDIS_REST_TOKEN", "").strip()
    if not value:
        raise RuntimeError("UPSTASH_REDIS_REST_TOKEN is not configured")
    return value


def _upstash_command(command: list[object]) -> object:
    req = urllib_request.Request(
        url=f"{_upstash_rest_url()}/",
        data=json.dumps(command).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {_upstash_rest_token()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(req, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib_error.URLError as exc:
        raise RuntimeError(f"Upstash request failed: {exc}") from exc

    if payload.get("error"):
        raise RuntimeError(f"Upstash command failed: {payload['error']}")
    return payload.get("result")


def _upstash_multi(commands: list[list[object]]) -> object:
    req = urllib_request.Request(
        url=f"{_upstash_rest_url()}/multi-exec",
        data=json.dumps(commands).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {_upstash_rest_token()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(req, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib_error.URLError as exc:
        raise RuntimeError(f"Upstash transaction failed: {exc}") from exc

    if payload.get("error"):
        raise RuntimeError(f"Upstash transaction failed: {payload['error']}")
    
    print("DEBUG payload multi:", payload, type(payload))
    return payload.get("result")


def _detect_first_scene_class(code: str) -> str | None:

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
    bucket = os.getenv("AWS_S3_BUCKET", "").strip()
    if not bucket:
        raise HTTPException(
            status_code=500,
            detail="S3 bucket is not configured. Set `S3_BUCKET` or `AWS_S3_BUCKET`.",
        )
    return bucket


def _get_aws_region() -> str:
    region = os.getenv("AWS_REGION", "").strip()
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


def _acknowledge_job(raw_job: str) -> None:
    _upstash_command(["LREM", _processing_queue_name(), 1, raw_job])


def _move_raw_job_to_dead_letter(raw_job: str, error_message: str) -> None:
    encoded_job = json.dumps(
        {
            "raw_job": raw_job,
            "attempt": _max_job_attempts(),
            "last_error": error_message,
        }
    )
    _upstash_multi(
        [
            ["LPUSH", _dead_letter_queue_name(), encoded_job],
            ["LREM", _processing_queue_name(), 1, raw_job],
        ]
    )


def _retry_or_dead_letter(job: QueuedRenderRequest, raw_job: str, error_message: str) -> bool:
    next_attempt = job.attempt + 1
    job_payload = job.model_dump()
    job_payload["attempt"] = next_attempt
    job_payload["last_error"] = error_message
    encoded_job = json.dumps(job_payload)

    if next_attempt >= _max_job_attempts():
        _upstash_multi(
            [
                ["LPUSH", _dead_letter_queue_name(), encoded_job],
                ["LREM", _processing_queue_name(), 1, raw_job],
            ]
        )
        return True

    _upstash_multi(
        [
            ["LPUSH", _queue_name(), encoded_job],
            ["LREM", _processing_queue_name(), 1, raw_job],
        ]
    )
    return False


def _extract_error_message(exc: Exception) -> str:
    if isinstance(exc, HTTPException):
        detail = exc.detail
        return detail if isinstance(detail, str) else json.dumps(detail)
    return str(exc) or exc.__class__.__name__


def _notify_api(project_id: str, status: Literal["finished", "failed"], error_message: str | None = None) -> None:
    payload = {
        "projectId": project_id,
        "status": status,
    }
    if error_message:
        payload["error"] = error_message

    headers = {
        "Content-Type": "application/json",
    }
    token = _worker_callback_token()
    if token:
        headers["x-worker-token"] = token

    body = json.dumps(payload).encode("utf-8")
    last_error: Exception | None = None

    for _ in range(3):
        req = urllib_request.Request(
            url=_api_callback_url(),
            data=body,
            headers=headers,
            method="POST",
        )
        try:
            with urllib_request.urlopen(req, timeout=30) as response:
                if 200 <= response.status < 300:
                    return
                raise RuntimeError(f"Callback failed with status {response.status}")
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(2)

    raise RuntimeError(f"Failed to notify API about render status: {last_error}") from last_error


def _pop_next_job() -> str | None:
    result = _upstash_command(["RPOPLPUSH", _queue_name(), _processing_queue_name()])
    return result if isinstance(result, str) else None


def _process_queued_job(raw_job: str) -> None:
    try:
        job = QueuedRenderRequest.model_validate_json(raw_job)
    except Exception as exc:  # noqa: BLE001
        _move_raw_job_to_dead_letter(raw_job, f"Invalid job payload: {_extract_error_message(exc)}")
        print(f"Discarded invalid queued job: {exc}", file=sys.stderr)
        return

    try:
        result = render_manim_to_video(job)
        try:
            _notify_api(job.project_id, "finished")
        finally:
            shutil.rmtree(result.work_dir, ignore_errors=True)
        _acknowledge_job(raw_job)
    except Exception as exc:  # noqa: BLE001
        error_message = _extract_error_message(exc)
        moved_to_dead_letter = _retry_or_dead_letter(job, raw_job, error_message)
        if moved_to_dead_letter:
            try:
                _notify_api(job.project_id, "failed", error_message)
            except Exception as callback_error:  # noqa: BLE001
                print(
                    f"Failed to notify API about final job failure for project {job.project_id}: "
                    f"{callback_error}",
                    file=sys.stderr,
                )
        else:
            print(
                f"Retrying render job for project {job.project_id} after error: {error_message}",
                file=sys.stderr,
            )


def _queue_consumer_loop() -> None:
    print("Render queue consumer started")
    while not _consumer_stop_event.is_set():
        try:
            raw_job = _pop_next_job()
            if not raw_job:
                _consumer_stop_event.wait(_queue_poll_interval_seconds())
                continue

            _process_queued_job(raw_job)
        except Exception as exc:  # noqa: BLE001
            print(f"Queue consumer error: {exc}", file=sys.stderr)
            _consumer_stop_event.wait(_queue_poll_interval_seconds())


@app.on_event("startup")
def start_queue_consumer() -> None:
    global _consumer_thread

    if not _consumer_enabled():
        print("Render queue consumer disabled")
        return

    if _consumer_thread and _consumer_thread.is_alive():
        return

    _consumer_stop_event.clear()
    _consumer_thread = threading.Thread(
        target=_queue_consumer_loop,
        name="render-queue-consumer",
        daemon=True,
    )
    _consumer_thread.start()


@app.on_event("shutdown")
def stop_queue_consumer() -> None:
    _consumer_stop_event.set()


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
