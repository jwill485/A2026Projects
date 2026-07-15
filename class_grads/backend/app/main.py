import asyncio
import os
import re
import uuid
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .groups_store import load_groups, save_groups
from .ranger import ranger_status

# .env lives at the repo root (two levels up from backend/app/)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

MILPACS_API_KEY = os.environ.get("MILPACS_API_KEY")
MILPACS_BASE_URL = "https://api.7cav.us/api/v1"

app = FastAPI(title="ClassGrads Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mirrors the position-title patterns RosterManager uses (buildRoster.ts),
# widened to cover the whole regiment rather than just 2-7. In scope: the
# three line battalions (1-7/2-7/3-7) and the ACD holding pool (its own
# A/B/C/D companies) — Regimental Staff, DEVCOM, and titles with no
# company/platoon/squad structure (New Recruit, test accounts) are
# deliberately excluded and simply won't match any pattern below.
BATTALION_HQ_RE = re.compile(r"^(\d-7) (Commanding Officer|Executive Officer|Sergeant Major)$")
COMPANY_HQ_RE = re.compile(r"^(Commander|Executive Officer|First Sergeant) ([A-Za-z])/([\w-]+)$")
PLATOON_HQ_RE = re.compile(r"^(Platoon Leader|Platoon Sergeant) (\d+)/([A-Za-z])/([\w-]+)$")
SQUAD_RE = re.compile(r"^(Section Leader|Assistant Section Leader|Trooper) (\d+)/(\d+)/([A-Za-z])/([\w-]+)$")

LINE_BATTALION_RE = re.compile(r"^\d-7$")

# ACD (the holding pool) has company-level leadership of its own but no
# battalion-level HQ titles in the position-title schema — the "Auxiliary"
# unit's CO/XO/SGM fill that role in practice, so they're treated as ACD's
# Battalion HQ (user-confirmed 2026-07-14).
AUXILIARY_ACD_HQ_ROLES = {
    "Auxiliary Commander": "officer",
    "Auxiliary Executive Officer": "officer",
    "Auxiliary Sergeant Major": "seniorNco",
}


def _unit_in_scope(unit: str) -> bool:
    return bool(LINE_BATTALION_RE.match(unit)) or unit == "ACD"


# Classifies an in-scope position title into the fields the frontend filters
# on. Returns None if the title doesn't match a known pattern or falls
# outside 1-7/2-7/3-7/ACD.
def classify_position(position_title: Optional[str]) -> Optional[dict]:
    if not position_title:
        return None

    if position_title in AUXILIARY_ACD_HQ_ROLES:
        return {
            "battalion": "ACD",
            "company": "HQ",
            "tier": AUXILIARY_ACD_HQ_ROLES[position_title],
            "echelon": "battalion",
        }

    m = BATTALION_HQ_RE.match(position_title)
    if m:
        designation, role = m.group(1), m.group(2)
        if not _unit_in_scope(designation):
            return None
        tier = "seniorNco" if role == "Sergeant Major" else "officer"
        return {"battalion": designation, "company": "HQ", "tier": tier, "echelon": "battalion"}

    m = COMPANY_HQ_RE.match(position_title)
    if m:
        role, letter, unit = m.group(1), m.group(2), m.group(3)
        if not _unit_in_scope(unit):
            return None
        tier = "seniorNco" if role == "First Sergeant" else "officer"
        return {"battalion": unit, "company": letter, "tier": tier, "echelon": "company"}

    m = PLATOON_HQ_RE.match(position_title)
    if m:
        role, _number, letter, unit = m.group(1), m.group(2), m.group(3), m.group(4)
        if not _unit_in_scope(unit):
            return None
        tier = "seniorNco" if role == "Platoon Sergeant" else "officer"
        return {"battalion": unit, "company": letter, "tier": tier, "echelon": "platoon"}

    m = SQUAD_RE.match(position_title)
    if m:
        role, _squad, _platoon, letter, unit = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
        if not _unit_in_scope(unit):
            return None
        tier = "trooper" if role == "Trooper" else "juniorNco"
        return {"battalion": unit, "company": letter, "tier": tier, "echelon": "squad"}

    return None


def _require_api_key() -> str:
    if not MILPACS_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="MILPACS_API_KEY is not set on the server. Add it to the root .env file.",
        )
    return MILPACS_API_KEY


# Custom Requirement Groups — user-defined, shared across everyone using the
# app (persisted to backend/data/groups.json). Separate from the built-in
# WW2 Ranger Selection Requirement (ranger.py), which keeps its own
# alias-tolerant matching. A group requirement is satisfied by an exact
# match against any of its acceptedClasses — the picker in the frontend only
# offers class text that's actually appeared in live data, and a unit can
# list multiple wording variants for one requirement if they want that same
# tolerance Ranger Selection has.
class GroupRequirementIn(BaseModel):
    label: str
    acceptedClasses: List[str]


class GroupIn(BaseModel):
    name: str
    requirements: List[GroupRequirementIn]


def compute_group_status(graduations: List[dict], group: dict) -> dict:
    detail_set = {g["details"] for g in graduations}
    missing_labels = [
        req["label"]
        for req in group["requirements"]
        if not detail_set.intersection(req["acceptedClasses"])
    ]
    total = len(group["requirements"])
    return {
        "id": group["id"],
        "name": group["name"],
        "requiredTotal": total,
        "requiredCompleted": total - len(missing_labels),
        "missingLabels": missing_labels,
        "qualified": len(missing_labels) == 0,
    }


@app.get("/api/groups")
async def get_groups():
    return load_groups()


@app.post("/api/groups")
async def create_group(group: GroupIn):
    groups = load_groups()
    new_group = {
        "id": uuid.uuid4().hex[:12],
        "name": group.name,
        "requirements": [r.model_dump() for r in group.requirements],
    }
    groups.append(new_group)
    save_groups(groups)
    return new_group


@app.put("/api/groups/{group_id}")
async def update_group(group_id: str, group: GroupIn):
    groups = load_groups()
    for g in groups:
        if g["id"] == group_id:
            g["name"] = group.name
            g["requirements"] = [r.model_dump() for r in group.requirements]
            save_groups(groups)
            return g
    raise HTTPException(status_code=404, detail="Group not found")


@app.delete("/api/groups/{group_id}")
async def delete_group(group_id: str):
    groups = load_groups()
    remaining = [g for g in groups if g["id"] != group_id]
    if len(remaining) == len(groups):
        raise HTTPException(status_code=404, detail="Group not found")
    save_groups(remaining)
    return {"deleted": group_id}


@app.get("/api/graduations")
async def get_graduations():
    api_key = _require_api_key()
    async with httpx.AsyncClient(timeout=30.0) as client:
        upstream, ranks_upstream = await asyncio.gather(
            client.get(
                f"{MILPACS_BASE_URL}/roster/ROSTER_TYPE_COMBAT",
                headers={"Authorization": f"Bearer {api_key}"},
            ),
            client.get(
                f"{MILPACS_BASE_URL}/milpacs/ranks",
                headers={"Authorization": f"Bearer {api_key}"},
            ),
        )
    if upstream.status_code != 200:
        raise HTTPException(status_code=upstream.status_code, detail="Upstream roster request failed")

    rank_order_by_id = {}
    if ranks_upstream.status_code == 200:
        for r in ranks_upstream.json().get("ranks", []):
            rank_order_by_id[r["rankId"]] = r["rankDisplayOrder"]

    profiles = upstream.json().get("profiles", {})
    stored_groups = load_groups()

    members = []
    for profile in profiles.values():
        user = profile.get("user")
        primary = profile.get("primary") or {}
        position_title = primary.get("positionTitle")
        classification = classify_position(position_title)
        if not user or not classification:
            continue

        graduations = sorted(
            (
                {"details": r["recordDetails"], "date": r["recordDate"]}
                for r in profile.get("records", [])
                if r.get("recordType") == "RECORD_TYPE_GRADUATION"
            ),
            key=lambda g: g["date"],
        )

        rank = profile.get("rank") or {}

        members.append(
            {
                "userId": user["userId"],
                "username": user["username"],
                "realName": profile.get("realName", ""),
                "rank": rank.get("rankShort", ""),
                "rankOrder": rank_order_by_id.get(rank.get("rankId"), 999999),
                "positionTitle": position_title or "",
                "mos": profile.get("mos") or "Unknown",
                "battalion": classification["battalion"],
                "company": classification["company"],
                "tier": classification["tier"],
                "echelon": classification["echelon"],
                "graduations": graduations,
                "ranger": ranger_status(graduations),
                "groups": [compute_group_status(graduations, g) for g in stored_groups],
            }
        )

    members.sort(key=lambda m: m["realName"])
    return members
