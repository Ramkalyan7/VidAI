# AI Service

FastAPI service that talks to Gemini and returns structured Manim generation output for the next conversation turn.

## Setup

1. Ensure `GEMINI_API_KEY` is set in `.env`.
2. Install dependencies:

```bash
uv sync
```

3. Run the server:

```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## Endpoints

- `GET /health`
- `POST /v1/conversation/next`

Request body:

```json
{
  "conversation": [
    { "role": "user", "content": "Create a Manim scene that animates a sine wave." }
  ],
  "model": "gemini-2.5-flash",
  "temperature": 0.3
}
```

Response body:

```json
{
  "model": "gemini-2.5-flash",
  "output": {
    "code": "from manim import *\\n...",
    "description": "A short description of the video or the changes made.",
    "error": null
  }
}
```

If the user prompt is gibberish, too vague, or missing enough context, the service should return:

```json
{
  "model": "gemini-2.5-flash",
  "output": {
    "code": null,
    "description": null,
    "error": "Please provide a clearer video prompt with the topic, style, and what should be animated."
  }
}
```
