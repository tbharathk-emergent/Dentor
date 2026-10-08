"""Request-level protections: rate limiting, login throttling, body-size cap.

The limiter is in-memory and per-process — correct for the current single-worker
deployment. If the API is ever scaled to many workers/hosts, back these counters
with Redis; the interfaces below won't need to change.
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .config import MAX_BODY_BYTES

_WINDOWS: dict[str, deque] = defaultdict(deque)
_MAX_TRACKED_KEYS = 10_000


def client_ip(request: Request) -> str:
    # uvicorn is run with --proxy-headers behind nginx, so request.client is the real IP.
    return request.client.host if request.client else "unknown"


def _hit(key: str, limit: int, window_seconds: int) -> float:
    """Record a hit; returns 0 if allowed, else seconds the caller must wait."""
    now = time.monotonic()
    q = _WINDOWS[key]
    while q and now - q[0] > window_seconds:
        q.popleft()
    if len(q) >= limit:
        return window_seconds - (now - q[0])
    q.append(now)
    if len(_WINDOWS) > _MAX_TRACKED_KEYS:  # bound memory under address-spraying
        _WINDOWS.clear()
    return 0


def rate_limit(scope: str, limit: int, window_seconds: int):
    """FastAPI dependency: at most `limit` calls per `window_seconds` per client IP."""

    async def dependency(request: Request):
        wait = _hit(f"{scope}:{client_ip(request)}", limit, window_seconds)
        if wait:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(max(1, int(wait)))},
            )

    return dependency


# --- Login failure throttling (per IP + account, so one clinic can't lock out another) ---

_FAIL_LIMIT = 5
_FAIL_WINDOW = 300  # 5 minutes


def check_login_allowed(request: Request, identifier: str) -> None:
    key = f"loginfail:{client_ip(request)}:{identifier.lower().strip()}"
    now = time.monotonic()
    q = _WINDOWS[key]
    while q and now - q[0] > _FAIL_WINDOW:
        q.popleft()
    if len(q) >= _FAIL_LIMIT:
        wait = int(_FAIL_WINDOW - (now - q[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed sign-in attempts. Try again in {max(1, wait)} seconds.",
            headers={"Retry-After": str(max(1, wait))},
        )


def record_login_failure(request: Request, identifier: str) -> None:
    _WINDOWS[f"loginfail:{client_ip(request)}:{identifier.lower().strip()}"].append(time.monotonic())


def clear_login_failures(request: Request, identifier: str) -> None:
    _WINDOWS.pop(f"loginfail:{client_ip(request)}:{identifier.lower().strip()}", None)


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": f"Request body too large (limit {MAX_BODY_BYTES // (1024 * 1024)} MB)."},
            )
        return await call_next(request)
