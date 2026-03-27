# Worker Service

FastAPI service that renders Manim Community Edition Python code to a `.mp4`.

## Run

```bash
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

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

Response:

- `200 OK` with `video/mp4` body (`render.mp4`)
- S3 upload also happens before the response is returned
- Response headers include:
  - `X-Video-S3-Bucket`
  - `X-Video-S3-Key` with shape `prep/videos/<projectId>/<jobId>.mp4`
  - `X-Video-S3-Url`

Required env:

```bash
S3_BUCKET=your-bucket-name
AWS_REGION=ap-south-1
```
