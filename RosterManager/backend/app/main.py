import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

# .env lives at the repo root (two levels up from backend/app/)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

MILPACS_API_KEY = os.environ.get("MILPACS_API_KEY")
MILPACS_BASE_URL = "https://api.7cav.us/api/v1"

app = FastAPI(title="RosterManager Backend")

# ALLOWED_ORIGIN is the deployed frontend's URL in production (e.g. a Render
# static site) -- unset locally, where the regex below covers every dev port.
_extra_origins = [o for o in [os.environ.get("ALLOWED_ORIGIN")] if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_extra_origins,
    # Regex rather than a fixed port: with the hub plus both standalone
    # frontends all defaulting to 5173, Vite auto-increments (5174, 5175...)
    # whenever more than one is running locally at once.
    allow_origin_regex=r"http://localhost:517\d",
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _require_api_key() -> str:
    if not MILPACS_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="MILPACS_API_KEY is not set on the server. Add it to the root .env file.",
        )
    return MILPACS_API_KEY


async def _proxy_get(path: str) -> Response:
    api_key = _require_api_key()
    async with httpx.AsyncClient() as client:
        upstream = await client.get(
            f"{MILPACS_BASE_URL}{path}",
            headers={"Authorization": f"Bearer {api_key}"},
        )
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type"),
    )


@app.get("/api/roster/{roster}")
async def get_roster(roster: str, lite: bool = True):
    suffix = "/lite" if lite else ""
    return await _proxy_get(f"/roster/{roster}{suffix}")


@app.get("/api/awol")
async def get_awol():
    return await _proxy_get("/milpacs/awol")


@app.get("/api/ranks")
async def get_ranks():
    return await _proxy_get("/milpacs/ranks")
