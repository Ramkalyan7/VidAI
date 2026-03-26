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
  "code": "from manim import *\\n\\nclass Main(Scene):\\n    def construct(self):\\n        self.play(Write(Text('Hello')))\n",
  "scene": "Main",
  "quality": "medium"
}
```

Response:

- `200 OK` with `video/mp4` body (`render.mp4`)
