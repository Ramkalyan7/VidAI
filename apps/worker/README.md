# Worker Service

FastAPI service that renders Manim Community Edition Python code to a `.mp4`.
It now consumes render jobs from an Upstash Redis queue instead of waiting for the API
to POST the Manim source directly.

## Run

```bash
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

When the app starts it launches a background queue consumer. The consumer:

- moves jobs from `RENDER_QUEUE_NAME` to a processing list
- renders the Manim scene
- uploads the final mp4 to S3
- calls the API callback endpoint to mark the project `finished` or `failed`

## Endpoints

- `GET /health`
- `POST /v1/render`

Request body:

```json
{
  "projectId": "project-123",
  "code": "from manim import *\\n\\nclass Main(Scene):\\n    def construct(self):\\n        self.play(Write(Text('Hello')))\n",
  "scene": "Main",
  "quality": "medium"
}
```

The `POST /v1/render` endpoint still works for direct/manual renders, but the normal
application flow is queue-based.

Required env:

```bash
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket-name
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
API_RENDER_CALLBACK_URL=http://localhost:5000/internal/worker/render-status
```

Optional env:

```bash
RENDER_QUEUE_NAME=render:jobs
RENDER_QUEUE_MAX_ATTEMPTS=3
RENDER_QUEUE_POLL_INTERVAL_SEC=5
WORKER_CALLBACK_TOKEN=shared-secret
RENDER_QUEUE_CONSUMER_ENABLED=true
```
