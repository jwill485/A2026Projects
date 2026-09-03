# Integration Notes for 7Cav Infrastructure

This doc is meant to get you from "what even is this" to "okay, I know how to host it" in one read. No
prior context assumed. (An earlier version of this project had a
Render-specific click-through deploy guide; that plan got dropped in
favor of hosting on regiment-owned infrastructure, so it's gone — this
doc replaces it.)

## What these apps actually do

Three small tools built for managing a few leadership initiatives.

**Roster Manager** — pulls the live regiment roster from the 7cav API and
renders it as an interactive org chart (Battalion → Company → Platoon →
Squad). You can drag troopers around to plan hypothetical reassignments
or battalion splits before they're real, and it keeps a change log of
what moved. When you're happy with a change, it can generate ready-to-post
"Transfer Post" text — BBCode, with the trooper's name hyperlinked to
their milpac — so you're not hand-typing forum posts. Everything you plan
is saved in your own browser, not shared with other visitors, so think of
it as a planning scratchpad, not a system of record.

**Course Graduations** — pulls the live roster and each trooper's training
records, and shows who's completed what. It automatically tracks the
WW2 Ranger Selection Requirement, and you can also define your own custom
"requirement groups" (e.g. "NCO Requirements Met") from any combination of
course completions — useful for tracking unit-specific quals the built-in
Ranger check doesn't cover. The current filtered view can be exported to
CSV.

**Unit Projects** — a lightweight tracker for unit initiatives: recruiting
drives, training rotations, base-building, whatever. Each project has a
status (Planning/Active/Complete/Shelved), a priority, an owner, a
category, and an optional target date. Also exports to CSV.

**The Hub** — one login, one nav bar, all three apps in one place, instead
of three separate URLs to remember.

## How it's built

One repo, four pieces: three independent backend services and one
frontend that unifies them.

| Piece | What it does | Tech |
|---|---|---|
| `RosterManager/backend` | Read-only proxy to the 7cav API (roster, ranks, AWOL) | Python / FastAPI |
| `class_grads/backend` | Course-graduation tracking, live pull + join against the 7cav API, custom requirement groups | Python / FastAPI |
| `unit_projects/backend` | Unit initiative/project tracker (own CRUD, no 7cav API dependency) | Python / FastAPI |
| `hub` | Single frontend shell mounting all three under one nav (`/roster`, `/grads`, `/projects`) | React + Vite, static build |

Each backend is fully independent — separate process, separate data,
separate `requirements.txt` (all three are identical: `fastapi==0.115.6`,
`uvicorn[standard]==0.34.0`, `httpx==0.28.1`, `python-dotenv==1.0.1`). The
hub is a static site (`npm run build` → `dist/`) that talks to all three
backends over HTTP from the browser — nothing server-side ties them
together, so you can host/restart/update each piece independently.

## Running each piece

All three backends run the same way:
```
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port <port>
```
Suggested local dev ports are 8000 (RosterManager), 8001 (class_grads),
8002 (unit_projects) — arbitrary, not load-bearing. Use whatever fits your
existing reverse-proxy/routing setup.

The hub:
```
npm install
npm run build
```
Produces static files in `hub/dist/` — serve with whatever's already
serving CavApps (Nginx, Caddy, a Node static server, etc.). The three
backend URLs are baked in **at build time** via env vars (see below), so
changing them later means a rebuild, not just a restart.

## Configuration (environment variables)

**RosterManager/backend and class_grads/backend** (both call the 7cav API):
- `MILPACS_API_KEY` — bearer token for `api.7cav.us`. Same key works for
  both; ask whoever holds the current one, or issue a fresh one scoped to
  these services if that's preferred.
- `ALLOWED_ORIGIN` — the hub's actual origin (e.g. `https://apps.7cav.us`),
  for CORS.
- `HUB_PASSWORD` / `SESSION_SECRET` — see Auth below.

**unit_projects/backend** (no 7cav API dependency):
- `ALLOWED_ORIGIN`, `HUB_PASSWORD`, `SESSION_SECRET` — same as above, no
  `MILPACS_API_KEY` needed.

**hub** (build-time only):
- `VITE_ROSTER_BACKEND_URL`, `VITE_GRADS_BACKEND_URL`,
  `VITE_PROJECTS_BACKEND_URL` — wherever the three backends actually end
  up reachable from the browser.

`HUB_PASSWORD` and `SESSION_SECRET` need to be **identical across all
three backends** — the login gate is stateless (an HMAC-signed token, no
shared database), so any one backend can issue a session token and all
three independently verify it against the same `SESSION_SECRET`. See Auth
below for why this exists and what it isn't.

## Data persistence

Two of the three backends write local JSON files, created on first write:
- `class_grads/backend/data/groups.json` — user-defined course-requirement
  groups.
- `unit_projects/backend/data/projects.json` — the project records
  themselves.

Both are plain whole-file read/write, no database, no locking. That's
fine at small scale with one trusted group, but they need a real
persistent path/volume wherever this ends up running — the files have to
live somewhere that survives restarts. Worth moving to an actual database
if this becomes long-term official infrastructure rather than a small
trusted-group tool; not done here, and nothing in the code depends on
staying file-based, so it's a clean swap later if needed.

RosterManager has no server-side persistence at all — saved
rosters/change logs live in each visitor's own browser `localStorage`, not
centrally.

## Auth — what's built, and what it isn't

Currently: a single shared password (`HUB_PASSWORD`), not per-user
accounts. Whoever knows it gets full access to view and edit everything
across all three apps — no roles, no audit trail of who changed what, no
rate-limiting on login attempts. This was built for a standalone Render
deployment, as the minimum needed to demo to a small trusted group without
exposing live roster data or edit endpoints to anyone with the URL — it
was never meant to be the permanent answer.

**Likely not needed once this sits behind CavApps' existing
infrastructure** — if access to that platform (or the network it's on)
is already gated at a broader level, this app-specific password layer
would just be redundant on top of it. Worth confirming rather than
assuming, but the expectation is this gets dropped (or left unset, since
it's opt-in — see below) in favor of whatever already controls access to
the rest of CavApps, not run side by side with it.

If per-app auth still ends up wanted for some reason (e.g. edit access
needs to be more restricted than view access, or CavApps' own gate
doesn't cover these routes), the fallback options are: keep
`HUB_PASSWORD` as-is, add real per-user accounts, or tie into whatever
7cav.us/CavApps already uses for auth (forum login, milpacs session,
etc.) — none of that beyond the current shared-password version has been
built.

Auth is **opt-in**: if `HUB_PASSWORD`/`SESSION_SECRET` are left unset on a
given backend, that backend serves every route with no auth check at all
— which is exactly the expected state if CavApps' own access control is
what's actually gating this.

## Networking note (why this doc replaced a Cloudflare workaround)

RosterManager's and class_grads' backends call `api.7cav.us` directly
over HTTPS. Requests from an external host (Render, specifically) were
getting served a Cloudflare managed-challenge page instead of real API
responses — datacenter/cloud IPs get challenged more aggressively than
trusted traffic. Running these backends on regiment-owned infrastructure
should sidestep that entirely, especially if they can reach the API over
an internal network rather than the public internet-facing endpoint —
worth confirming that's actually the case for wherever this lands, since
if it still has to go out over the public internet the way Render's
traffic did, the same challenge could resurface.

## Known limitations / not yet built

- No per-user auth — expected to be unnecessary here, see Auth above.
- No rate-limiting/lockout on `/api/login`, if that route ends up used at
  all.
- JSON-file storage, not a database (see Data persistence above).
- `RosterManager/frontend` and `class_grads/frontend` still exist as
  separate standalone copies of the frontend code the hub also mounts —
  historical, from before the hub existed. Not required for the hub to
  work; worth deciding whether to keep maintaining them.
- Category (Unit Projects) and course-name matching (class_grads' custom
  groups) are free text, not fixed/validated lists.

## Questions worth asking before integrating

- Can these backends reach `api.7cav.us` over an internal network, or
  only the public endpoint?
- Where should the two JSON data files actually live so they survive
  restarts?
- Does CavApps' existing access control actually cover these routes once
  integrated, or is there a gap the shared-password layer would still
  need to fill?
- What's the actual public URL/path this should live at (affects
  `ALLOWED_ORIGIN` and the `VITE_*_BACKEND_URL` build vars)?
