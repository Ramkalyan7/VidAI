from __future__ import annotations

import json
import shutil
import sys
import threading
import time
from typing import Literal

from config import (
    CALLBACK_RETRY_COUNT,
    CALLBACK_RETRY_DELAY_SEC,
    callback_token,
    callback_url,
    consumer_enabled,
    max_job_attempts,
    queue_names,
    queue_poll_interval_seconds,
)
from http_client import http_json_request, upstash_command, upstash_multi
from models import QueuedRenderRequest
from rendering import extract_error_message, render_manim_to_video

consumer_thread: threading.Thread | None = None
consumer_stop_event = threading.Event()


def acknowledge_job(raw_job: str) -> None:
    upstash_command(["LREM", queue_names().processing, 1, raw_job])


def move_to_dead_letter(raw_job: str, encoded_job: str) -> None:
    names = queue_names()
    upstash_multi(
        [
            ["LPUSH", names.dead_letter, encoded_job],
            ["LREM", names.processing, 1, raw_job],
        ]
    )


def move_invalid_job_to_dead_letter(raw_job: str, error_message: str) -> None:
    encoded_job = json.dumps(
        {
            "raw_job": raw_job,
            "attempt": max_job_attempts(),
            "last_error": error_message,
        }
    )
    move_to_dead_letter(raw_job, encoded_job)


def retry_or_dead_letter(job: QueuedRenderRequest, raw_job: str, error_message: str) -> bool:
    next_attempt = job.attempt + 1
    encoded_job = json.dumps(
        {
            **job.model_dump(),
            "attempt": next_attempt,
            "last_error": error_message,
        }
    )
    names = queue_names()

    if next_attempt >= max_job_attempts():
        move_to_dead_letter(raw_job, encoded_job)
        return True

    upstash_multi(
        [
            ["LPUSH", names.pending, encoded_job],
            ["LREM", names.processing, 1, raw_job],
        ]
    )
    return False


def notify_api(project_id: str, status: Literal["finished", "failed"], error_message: str | None = None) -> None:
    payload: dict[str, str] = {
        "projectId": project_id,
        "status": status,
    }
    if error_message:
        payload["error"] = error_message

    headers: dict[str, str] = {}
    token = callback_token()
    if token:
        headers["x-worker-token"] = token

    last_error: Exception | None = None
    for _ in range(CALLBACK_RETRY_COUNT):
        try:
            http_json_request(callback_url(), payload, headers=headers)
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(CALLBACK_RETRY_DELAY_SEC)

    raise RuntimeError(f"Failed to notify API about render status: {last_error}") from last_error


def pop_next_job() -> str | None:
    names = queue_names()
    result = upstash_command(["RPOPLPUSH", names.pending, names.processing])
    return result if isinstance(result, str) else None


def process_queued_job(raw_job: str) -> None:
    try:
        job = QueuedRenderRequest.model_validate_json(raw_job)
    except Exception as exc:  # noqa: BLE001
        move_invalid_job_to_dead_letter(raw_job, f"Invalid job payload: {extract_error_message(exc)}")
        print(f"Discarded invalid queued job: {exc}", file=sys.stderr)
        return

    try:
        result = render_manim_to_video(job)
        try:
            notify_api(job.project_id, "finished")
        finally:
            shutil.rmtree(result.work_dir, ignore_errors=True)
        acknowledge_job(raw_job)
    except Exception as exc:  # noqa: BLE001
        error_message = extract_error_message(exc)
        is_dead_lettered = retry_or_dead_letter(job, raw_job, error_message)

        if is_dead_lettered:
            try:
                notify_api(job.project_id, "failed", error_message)
            except Exception as callback_error:  # noqa: BLE001
                print(
                    f"Failed to notify API about final job failure for project {job.project_id}: {callback_error}",
                    file=sys.stderr,
                )
        else:
            print(
                f"Retrying render job for project {job.project_id} after error: {error_message}",
                file=sys.stderr,
            )


def queue_consumer_loop() -> None:
    print("Render queue consumer started")
    while not consumer_stop_event.is_set():
        try:
            raw_job = pop_next_job()
            if raw_job:
                process_queued_job(raw_job)
                continue
        except Exception as exc:  # noqa: BLE001
            print(f"Queue consumer error: {exc}", file=sys.stderr)

        consumer_stop_event.wait(queue_poll_interval_seconds())


def start_queue_consumer() -> None:
    global consumer_thread

    if not consumer_enabled():
        print("Render queue consumer disabled")
        return

    if consumer_thread and consumer_thread.is_alive():
        return

    consumer_stop_event.clear()
    consumer_thread = threading.Thread(
        target=queue_consumer_loop,
        name="render-queue-consumer",
        daemon=True,
    )
    consumer_thread.start()


def stop_queue_consumer() -> None:
    consumer_stop_event.set()
