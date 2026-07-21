# Unit Projects — Design Document

## 1. Product Overview

**Purpose:** Track unit initiatives/operations for the 7th Cavalry Regiment
— event planning, recruiting drives, training rotations, base-building,
and similar organizational work. Distinct from RosterManager (org
structure) and class_grads (training records).

**Status:** Framework only, scaffolded 2026-07-15. No data model, no real
features — a backend that returns an empty list and a hub page that proves
it can reach it. Everything below is intent and open questions, not
built.

---

## 2. Architecture (built so far)

Unlike RosterManager and class_grads, this project has **no standalone
frontend** — it lives directly inside `hub/src/projects/` from day one.
Both older projects predated the hub and keep a standalone copy of their
frontend for historical reasons (see their own design docs' "broader
vision" sections); starting this one hub-only avoids that dual-copy
sync burden on day one.

- **`backend/`** — FastAPI app (`app/main.py`). CORS follows the same
  pattern as RosterManager/class_grads (`ALLOWED_ORIGIN` env var for
  production + a `localhost:517\d` regex for local dev). One placeholder
  endpoint, `GET /api/projects`, returning `[]`.
- **`hub/src/projects/ProjectsApp.tsx`** — fetches that endpoint and shows
  a connectivity message. Mounted at `/projects` in the hub's nav
  ("Unit Projects").
- **Local dev port**: 8002 (RosterManager is 8000, class_grads is 8001).
- No `.env`/secrets yet — nothing needs `MILPACS_API_KEY` until owners are
  linked to real troopers (see §3).

---

## 3. Open questions for the next design conversation

None of this is decided — capturing what's worth thinking through before
building real features:

- **What is a "project"?** Likely fields: name, description, status
  (planning/active/complete/shelved?), owner(s), target date. Worth
  looking at how similar tracking has been done informally before (a
  spreadsheet? a forum thread? nothing?) to avoid designing in a vacuum.
- **Do project owners/participants link back to real troopers?** If so,
  this needs the same `MILPACS_API_KEY` + live roster pull pattern
  RosterManager/class_grads use, and raises the same "shared domain logic"
  question already flagged in class_grads' design doc §7 (three separate
  position-title/scope implementations already exist).
- **Persistence**: a JSON file like class_grads' `groups.json` (simple,
  works for one small trusted group, no concurrent-write safety), or
  something more real (SQLite/Postgres) if this is expected to grow or
  have multiple simultaneous editors?
- **Status workflow**: freeform status text, or a fixed set of stages with
  rules about what can move where?
- **Auth**: same open item as the other two apps (see class_grads' design
  doc §7) — more pressing here if projects are meant to be edited by
  several different people rather than just viewed.

---

## 4. Related

- `hub/HOW_TO_USE.md` — running all three backends + the hub together.
- `class_grads/class_grads_design_doc.md` §7 — the broader "compose vs.
  merge" discussion this project is also subject to.
