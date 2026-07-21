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

- **Owner linking to real troopers** — deferred at v1 (see §2.1). Would
  need the same `MILPACS_API_KEY` + live roster pull pattern
  RosterManager/class_grads use, and raises the same "shared domain logic"
  question already flagged in class_grads' design doc §7 (three separate
  position-title/scope implementations already exist).
- **Auth** — same open item as the other two apps (see class_grads' design
  doc §7) — more pressing here since projects are meant to be *edited* by
  several different people, not just viewed.
- **Category as a fixed set** — currently freeform, so nothing stops
  typos/near-duplicates ("Recruiting" vs "recruiting drive") from
  splitting the filter. Revisit if that becomes an actual problem in
  practice rather than guessing now.
- Nothing about the CSV-injection or Excel-date-coercion guards applied to
  class_grads' exports has been considered here yet — this app doesn't
  export CSV, but worth remembering if that's ever added.

---

## 4. Related

- `hub/HOW_TO_USE.md` — running all three backends + the hub together.
- `class_grads/class_grads_design_doc.md` §7 — the broader "compose vs.
  merge" discussion this project is also subject to.
