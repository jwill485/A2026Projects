# Integration Notes for 7Cav Infrastructure

For whoever's hosting this — a technical overview of what these apps are,
how they're built, and what they need to run. (An earlier version of this
project had a Render-specific click-through deploy guide; that plan was
dropped in favor of hosting on regiment-owned infrastructure, so it's been
removed rather than left stale.)

## What this is

One repo, four pieces: three independent backend services and one
frontend that unifies them behind a single nav.

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
together.

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
changing them requires a rebuild, not just a restart.

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

`HUB_PASSWORD` and `SESSION_SECRET` must be **identical across all three
backends** — the login gate is stateless (HMAC-signed token, no shared
database), so any one backend can issue a session token and all three
independently verify it against the same `SESSION_SECRET`. See Auth below
for why this exists and what it isn't.

## Data persistence

Two of the three backends write local JSON files, created on first write:
- `class_grads/backend/data/groups.json` — user-defined course-requirement
  groups.
- `unit_projects/backend/data/projects.json` — the project records
  themselves.

Both are plain whole-file read/write, no database, no locking. Fine at
small scale with one trusted group; **needs a real persistent
path/volume** wherever this ends up running (this was flagged as a known
gap on Render specifically because its free tier has no persistent disk —
less of an issue on infrastructure you control, but the files still need
to live somewhere that survives restarts/redeploys). Worth moving to an
actual database if this becomes long-term official infrastructure rather
than a small trusted-group tool — not done here, no code currently depends
on staying file-based.

RosterManager has no server-side persistence at all — saved
rosters/change logs live in each visitor's own browser `localStorage`, not
centrally.

## Auth — what's built, and what it isn't

Currently: a single shared password (`HUB_PASSWORD`), not per-user
accounts. Whoever knows it gets full access to view and edit everything
across all three apps — no roles, no audit trail of who changed what, no
rate-limiting on login attempts. This was built as the minimum needed to
demo to a small trusted group, not designed for a wider audience.

If this becomes real infrastructure under your management, worth deciding
whether to keep it as-is, add per-user accounts, or tie into whatever
7cav.us/CavApps already uses for auth (forum login, milpacs session,
etc.) — that's a bigger change than anything built so far and hasn't been
started.

Auth is **opt-in**: if `HUB_PASSWORD`/`SESSION_SECRET` are left unset on a
given backend, that backend serves every route with no auth check at all
— useful for local dev, probably not what you want on anything publicly
reachable.

## Networking note (why this doc exists instead of a Cloudflare workaround)

RosterManager's and class_grads' backends call `api.7cav.us` directly
over HTTPS. Requests from an external host (e.g. Render) were getting
served a Cloudflare managed-challenge page instead of real API responses
— datacenter/cloud IPs get challenged more aggressively than trusted
traffic. Running these backends on regiment-owned infrastructure should
avoid that entirely, especially if they can reach the API over an
internal network rather than the public internet-facing endpoint — worth
confirming that's actually the case for wherever this lands, since if it
still has to go out over the public internet the same way Render's
traffic did, the same challenge could resurface.

## Known limitations / not yet built

- No per-user auth (see above).
- No rate-limiting/lockout on `/api/login`.
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
- Is the current single-shared-password auth acceptable for this
  audience, or does it need to become per-user before going live more
  broadly?
- What's the actual public URL/path this should live at (affects
  `ALLOWED_ORIGIN` and the `VITE_*_BACKEND_URL` build vars)?
