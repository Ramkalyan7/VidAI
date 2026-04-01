import shutil
from dotenv import load_dotenv
from fastapi import FastAPI
from models import RenderRequest
from queue_consumer import (
    start_queue_consumer as start_queue_consumer_loop,
    stop_queue_consumer as stop_queue_consumer_loop,
)
from rendering import render_manim_to_video

load_dotenv()

app = FastAPI(title="worker", version="0.1.0")


@app.on_event("startup")
def start_queue_consumer() -> None:
    start_queue_consumer_loop()


@app.on_event("shutdown")
def stop_queue_consumer() -> None:
    stop_queue_consumer_loop()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/render")
def render(payload: RenderRequest) -> dict[str, str]:
    result = render_manim_to_video(payload)
    shutil.rmtree(result.work_dir, ignore_errors=True)

    return {
        "status": "success",
        "message": "Video rendered and uploaded successfully",
        "project_id": payload.project_id,
    }
