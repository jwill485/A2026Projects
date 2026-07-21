import os
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .projects_store import load_projects, save_projects

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

Status = Literal["planning", "active", "complete", "shelved"]
Priority = Literal["low", "medium", "high"]


class ProjectIn(BaseModel):
    name: str
    description: str = ""
    status: Status = "planning"
    owner: str = ""
    priority: Priority = "medium"
    category: str = ""
    # Free-text-ish ISO date (yyyy-mm-dd) rather than a real date type --
    # matches how the rest of this toolset treats dates as plain strings.
    targetDate: Optional[str] = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.get("/api/projects")
async def list_projects() -> List[dict]:
    return load_projects()


@app.post("/api/projects")
async def create_project(project: ProjectIn) -> dict:
    projects = load_projects()
    now = _now()
    new_project = {
        "id": uuid.uuid4().hex[:12],
        **project.model_dump(),
        "createdAt": now,
        "updatedAt": now,
    }
    projects.append(new_project)
    save_projects(projects)
    return new_project


@app.put("/api/projects/{project_id}")
async def update_project(project_id: str, project: ProjectIn) -> dict:
    projects = load_projects()
    for i, existing in enumerate(projects):
        if existing["id"] == project_id:
            updated = {
                **existing,
                **project.model_dump(),
                "updatedAt": _now(),
            }
            projects[i] = updated
            save_projects(projects)
            return updated
    raise HTTPException(status_code=404, detail="Project not found")


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str) -> dict:
    projects = load_projects()
    remaining = [p for p in projects if p["id"] != project_id]
    if len(remaining) == len(projects):
        raise HTTPException(status_code=404, detail="Project not found")
    save_projects(remaining)
    return {"deleted": project_id}
