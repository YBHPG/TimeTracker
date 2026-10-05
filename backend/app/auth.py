import secrets

from fastapi import Request
from fastapi.responses import JSONResponse

from app import config

# New analytics endpoints are the only reads that require the token.
# The web UI (tasks/days/export) keeps working without it.
_PROTECTED_READ_PATHS = {"/api/summary", "/api/entries"}
_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _presented_token(request: Request):
    header = request.headers.get("authorization", "")
    prefix = "bearer "
    if header.lower().startswith(prefix):
        return header[len(prefix):].strip()
    return None


def _matches(presented, token: str) -> bool:
    return presented is not None and secrets.compare_digest(presented, token)


def _rejection(request: Request):
    """Returns a JSON error response when the request must be rejected, else None."""
    token = config.READ_TOKEN
    if not token:
        return None

    path = request.url.path
    method = request.method.upper()

    # Always-open paths and CORS preflight.
    if path == "/api/health" or not path.startswith("/api/") or method == "OPTIONS":
        return None

    presented = _presented_token(request)

    if method in ("GET", "HEAD"):
        if path in _PROTECTED_READ_PATHS and not _matches(presented, token):
            return JSONResponse(
                {"detail": "Unauthorized"},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )
        return None

    # Write routes are unchanged (open locally), but a read token must never write.
    if method in _WRITE_METHODS and _matches(presented, token):
        return JSONResponse(
            {"detail": "Read token cannot perform write operations"},
            status_code=403,
        )
    return None


async def auth_and_version_middleware(request: Request, call_next):
    rejection = _rejection(request)
    response = rejection if rejection is not None else await call_next(request)
    response.headers["X-Tracker-Version"] = config.API_VERSION
    return response
