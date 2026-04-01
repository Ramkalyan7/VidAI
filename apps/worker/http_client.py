from __future__ import annotations

import json
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from config import REQUEST_TIMEOUT_SEC, upstash_rest_token, upstash_rest_url


def http_json_request(url: str, payload: Any, headers: dict[str, str] | None = None) -> dict[str, Any]:
    request_headers = {
        "Content-Type": "application/json",
        **(headers or {}),
    }
    req = urllib_request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers=request_headers,
        method="POST",
    )

    try:
        with urllib_request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib_error.URLError as exc:
        raise RuntimeError(f"HTTP request failed: {exc}") from exc


def upstash_command(command: list[Any]) -> Any:
    payload = http_json_request(
        f"{upstash_rest_url()}/",
        command,
        headers={"Authorization": f"Bearer {upstash_rest_token()}"},
    )
    error = payload.get("error")
    if error:
        raise RuntimeError(f"Upstash command failed: {error}")
    return payload.get("result")


def upstash_multi(commands: list[list[Any]]) -> Any:
    payload = http_json_request(
        f"{upstash_rest_url()}/multi-exec",
        commands,
        headers={"Authorization": f"Bearer {upstash_rest_token()}"},
    )
    error = payload.get("error")
    if error:
        raise RuntimeError(f"Upstash transaction failed: {error}")
    return payload.get("result")
