import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Unit Projects Backend")

# ALLOWED_ORIGIN is the deployed frontend's URL in production (e.g. a Render
# static site) -- unset locally, where the regex below covers every dev port.
_extra_origins = [o for o in [os.environ.get("ALLOWED_ORIGIN")] if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_extra_origins,
    # Regex rather than a fixed port: with the hub plus any standalone
    # frontend defaulting to 5173, Vite auto-increments (5174, 5175...)
    # whenever more than one is running locally at once.
    allow_origin_regex=r"http://localhost:517\d",
    allow_methods=["*"],
    allow_headers=["*"],
)


# Framework-only placeholder -- proves the hub's /projects route can reach
# this service. Real data model (what a "project" has: status, owner,
# deadline, etc.) isn't designed yet -- see unit_projects_design_doc.md.
@app.get("/api/projects")
async def list_projects() -> list[dict]:
    return []
