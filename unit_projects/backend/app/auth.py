import hashlib
import hmac
import os
import time
import warnings
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Header, HTTPException

# Loaded here (not just in main.py) because this module reads HUB_PASSWORD/
# SESSION_SECRET from the environment at import time -- if main.py imported
# this before calling its own load_dotenv(), values set only in the .env
# file (not already in the shell) would be invisible here. Safe to call
# twice; python-dotenv is a no-op if the vars are already set.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

HUB_PASSWORD = os.environ.get("HUB_PASSWORD")
SESSION_SECRET = os.environ.get("SESSION_SECRET")

# Auth is opt-in: leave both unset (the default for local dev) and every
# route behaves exactly as it did before auth existed. Both get set
# together on the deployed demo. Setting only one is almost certainly a
# misconfiguration, so it's called out rather than silently leaving auth
# off.
if bool(HUB_PASSWORD) != bool(SESSION_SECRET):
    warnings.warn(
        "HUB_PASSWORD and SESSION_SECRET must both be set to enable auth -- "
        "only one is set, so auth is staying disabled."
    )
AUTH_ENABLED = bool(HUB_PASSWORD and SESSION_SECRET)

SESSION_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days


def _sign(payload: str) -> str:
    return hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()


def issue_token() -> str:
    expires = str(int(time.time()) + SESSION_TTL_SECONDS)
    return f"{expires}.{_sign(expires)}"


def _token_valid(token: str) -> bool:
    try:
        expires, signature = token.split(".", 1)
    except ValueError:
        return False
    if not hmac.compare_digest(_sign(expires), signature):
        return False
    return int(expires) > int(time.time())


def check_password(password: str) -> bool:
    return hmac.compare_digest(password, HUB_PASSWORD or "")


def session_status(authorization: Optional[str]) -> dict:
    if not AUTH_ENABLED:
        return {"authRequired": False, "valid": True}
    valid = bool(
        authorization
        and authorization.startswith("Bearer ")
        and _token_valid(authorization.removeprefix("Bearer "))
    )
    return {"authRequired": True, "valid": valid}


# FastAPI dependency -- add to every route except /api/login and /api/session.
async def require_session(authorization: Optional[str] = Header(None)) -> None:
    if not AUTH_ENABLED:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid session token")
    if not _token_valid(authorization.removeprefix("Bearer ")):
        raise HTTPException(status_code=401, detail="Session expired or invalid")
