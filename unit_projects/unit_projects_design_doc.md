# Unit Projects — Design Document

## 1. Product Overview

**Purpose:** Track unit initiatives/operations for the 7th Cavalry Regiment
— event planning, recruiting drives, training rotations, base-building,
and similar organizational work. Distinct from RosterManager (org
structure) and class_grads (training records).

**Status:** V1 built 2026-07-21 — live CRUD list/filter/sort view. Framework
scaffolded 2026-07-15; the questions in §3 got answered the same day work
resumed, see §2.1 for what each decision became.

---

## 2. Architecture

Unlike RosterManager and class_grads, this project has **no standalone
frontend** — it lives directly inside `hub/src/projects/` from day one.
Both older projects predated the hub and keep a standalone copy of their
frontend for historical reasons (see their own design docs' "broader
vision" sections); starting this one hub-only avoids that dual-copy
sync burden on day one.

- **`backend/app/main.py`** — FastAPI app with full CRUD:
  `GET/POST /api/projects`, `PUT/DELETE /api/projects/{id}`. CORS follows
  the same pattern as RosterManager/class_grads (`ALLOWED_ORIGIN` env var
  for production + a `localhost:517\d` regex for local dev).
- **`backend/app/projects_store.py`** + **`backend/data/projects.json`** —
  persistence, mirroring class_grads' `groups_store.py`/`groups.json`
  exactly: plain JSON file, read/written on every CRUD call, gitignored
  (local instance data, not source). Same known tradeoff: fine for one
  trusted small group, no concurrent-write safety, and no persistent disk
  if ever deployed to Render's free tier (see `DEPLOY.md`).
- **`hub/src/projects/`**:
  - `types.ts` — `Project`/`ProjectInput`/`Status`/`Priority`.
  - `constants.ts` — status/priority display order and labels.
  - `ProjectEditor.tsx` — create/edit form (name, description, status,
    priority, owner, category, target date).
  - `ProjectsApp.tsx` — search, filter (status/priority/category —
    category options built from what's actually present, same pattern as
    class_grads' battalion/company filters), sortable table, expandable
    rows (description), inline delete confirmation. Modal editor overlay
    reuses the `.groups-panel*` class names class_grads' Custom Groups
    panel uses, but scoped to this route via `projects.css` — no
    cross-route collision since each route only imports its own CSS file.
- **Local dev port**: 8002 (RosterManager is 8000, class_grads is 8001).

### 2.1 What the v1 field/workflow questions became

- **Fields**: name, description, status, owner, priority, category, target
  date, plus system-managed `createdAt`/`updatedAt`.
- **Status**: fixed stages — Planning / Active / Complete / Shelved.
- **Owner**: free text for now, not linked to real troopers. Upgrading to
  a live-roster picker later is additive (the field's already a plain
  string) and wouldn't break existing projects.
- **Persistence**: JSON file, per above.
- **Priority**: added beyond the original 3-question scope — High / Medium
  / Low, fixed set like Status.
- **Category**: free text (not a fixed set) — filter options are built
  from whatever's actually been typed across existing projects, so it
  grows naturally rather than needing a predefined list maintained
  somewhere.

---

## 3. Still open

- ~~Auth~~ — done, 2026-07-22 (see class_grads' design doc §7 for the full
  writeup, since it's built once and shared across all three backends).
  Single shared password (`HUB_PASSWORD`), not per-user accounts — anyone
  who's logged in can still edit/delete any project. No per-user
  attribution; revisit if that becomes an actual need.
- ~~CSV export~~ — done. Exports exactly what the table is showing (current
  filter/search/sort), same `csvCell()`/`forceText()` guards against
  formula injection and date auto-coercion as class_grads' exports.

**Decided against (not being pursued):**
- Owner linking to real troopers — staying free text. Not worth the
  `MILPACS_API_KEY` + live roster pull integration for this app.
- Category as a fixed set — staying freeform. Typo/near-duplicate risk
  ("Recruiting" vs "recruiting drive") accepted rather than maintaining a
  predefined list.

---

## 4. Related

- `hub/HOW_TO_USE.md` — running all three backends + the hub together.
- `class_grads/class_grads_design_doc.md` §7 — the broader "compose vs.
  merge" discussion this project is also subject to.
