from __future__ import annotations

import os
from dataclasses import dataclass

from fastapi import HTTPException

DEFAULT_RENDER_TIMEOUT_SEC = 180
DEFAULT_QUEUE_POLL_INTERVAL_SEC = 5.0
DEFAULT_MAX_JOB_ATTEMPTS = 3
DEFAULT_QUEUE_NAME = "render:jobs"
DEFAULT_CALLBACK_URL = "http://localhost:5000/internal/worker/render-status"
REQUEST_TIMEOUT_SEC = 30
CALLBACK_RETRY_DELAY_SEC = 2
CALLBACK_RETRY_COUNT = 3
MAX_RENDER_ERROR_DETAIL_LENGTH = 6000


@dataclass(frozen=True)
class QueueNames:
    pending: str
    processing: str
    dead_letter: str


def env_str(name: str, default: str | None = None, *, required: bool = False) -> str:
    raw_value = os.getenv(name)
    value = raw_value.strip() if raw_value is not None else ""

    if value:
        return value

    if default is not None:
        return default

    if required:
        raise RuntimeError(f"{name} is not configured")

    return ""


def env_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if not raw_value:
        return default

    try:
        value = int(raw_value)
    except ValueError:
        return default

    return value if value > 0 else default


def env_float(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if not raw_value:
        return default

    try:
        value = float(raw_value)
    except ValueError:
        return default

    return value if value > 0 else default


def env_bool(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if not raw_value:
        return default

    return raw_value.strip().lower() not in {"0", "false", "no", "off"}


def render_timeout_seconds() -> int:
    return env_int("RENDER_TIMEOUT_SEC", DEFAULT_RENDER_TIMEOUT_SEC)


def queue_poll_interval_seconds() -> float:
    return env_float("RENDER_QUEUE_POLL_INTERVAL_SEC", DEFAULT_QUEUE_POLL_INTERVAL_SEC)


def max_job_attempts() -> int:
    return env_int("RENDER_QUEUE_MAX_ATTEMPTS", DEFAULT_MAX_JOB_ATTEMPTS)


def queue_names() -> QueueNames:
    pending = env_str("RENDER_QUEUE_NAME", DEFAULT_QUEUE_NAME)
    return QueueNames(
        pending=pending,
        processing=f"{pending}:processing",
        dead_letter=f"{pending}:dead",
    )


def callback_url() -> str:
    return env_str("API_RENDER_CALLBACK_URL", DEFAULT_CALLBACK_URL)


def callback_token() -> str | None:
    token = env_str("WORKER_CALLBACK_TOKEN")
    return token or None


def consumer_enabled() -> bool:
    return env_bool("RENDER_QUEUE_CONSUMER_ENABLED", True)


def upstash_rest_url() -> str:
    return env_str("UPSTASH_REDIS_REST_URL", required=True).rstrip("/")


def upstash_rest_token() -> str:
    return env_str("UPSTASH_REDIS_REST_TOKEN", required=True)


def s3_bucket() -> str:
    bucket = env_str("AWS_S3_BUCKET")
    if not bucket:
        raise HTTPException(
            status_code=500,
            detail="S3 bucket is not configured. Set `S3_BUCKET` or `AWS_S3_BUCKET`.",
        )
    return bucket


def aws_region() -> str:
    region = env_str("AWS_REGION")
    if not region:
        raise HTTPException(status_code=500, detail="AWS region is not configured. Set `AWS_REGION`")
    return region
