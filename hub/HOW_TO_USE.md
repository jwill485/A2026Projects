# 7Cav Apps Hub — How to Use

One page, one URL, three tools: Roster Manager, Course Graduations, and
Unit Projects, side by side behind a shared nav. Each still talks to its
own existing backend and data — this is a shared frontend shell, not a
merged app.

## Running it locally

You need **four terminal windows** open at the same time: one per backend,
one for the hub frontend. Leave all four running while you use the app.

**Terminal 1 — RosterManager backend (port 8000)**
```
cd "C:\Users\cskat\OneDrive\Desktop\7Cav\a2026Projects\RosterManager\backend"
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Course Graduations backend (port 8001)**

Note the port — this is different from class_grads' own standalone
instructions (which use 8000), because both backends need to run at once
under the hub and can't share a port.
```
cd "C:\Users\cskat\OneDrive\Desktop\7Cav\a2026Projects\class_grads\backend"
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001
```

**Terminal 3 — Unit Projects backend (port 8002)**
```
cd "C:\Users\cskat\OneDrive\Desktop\7Cav\a2026Projects\unit_projects\backend"
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8002
```

**Terminal 4 — hub frontend (port 5173)**
```
cd "C:\Users\cskat\OneDrive\Desktop\7Cav\a2026Projects\hub"
npm run dev
```

Then open `http://localhost:5173` in your browser. Use the sidebar to
switch between **Roster Manager**, **Course Graduations**, and
**Unit Projects** — each stays mounted at its own URL (`/roster`, `/grads`,
`/projects`) so bookmarks and the back/forward buttons work normally.

**When you're done**, close all four terminal windows (or `Ctrl+C` in
each).

## Login (only if `HUB_PASSWORD` is set)

The hub can sit behind a single shared password — see `../DEPLOY.md` for
the deployed setup. Locally, none of the three backends' `.env` files set
`HUB_PASSWORD`/`SESSION_SECRET` by default, so the app opens straight to
the sidebar with no login prompt, exactly as before this existed. To test
the login flow locally, add matching `HUB_PASSWORD=`/`SESSION_SECRET=`
lines to all three `.env` files (`RosterManager/.env`, `class_grads/.env`,
`unit_projects/.env`) with **identical values in each** — the login gate
is stateless, so any one of the three backends can issue a session token
and all three independently verify it against the same `SESSION_SECRET`.
Restart the backends after changing `.env`.

## Why separate backends and one frontend

Roster Manager and Course Graduations were built as fully separate
projects, each with its own FastAPI backend and its own data (Roster
Manager's saved rosters/change logs live in the browser's local storage;
Course Graduations' custom groups live in `class_grads/backend/data/`).
Unit Projects was scaffolded hub-only from the start (see its own design
doc) but still keeps a separate backend, same reasoning. The hub only
unifies the **frontend** — a single React app with `react-router-dom`
routes, each one rendering the other projects' (otherwise-unmodified) UI
code. Merging the backends/data into one service is a bigger future step,
not done here — see `class_grads/class_grads_design_doc.md` §7.

## Troubleshooting

- **A route shows "Failed to load" / "Failed to fetch"** — the matching
  backend terminal probably isn't running, or is running on the wrong
  port. Roster Manager expects `8000`; Course Graduations expects `8001`;
  Unit Projects expects `8002`.
- **Port already in use** — on Windows, `uvicorn --reload` can leave an
  orphaned worker process behind if the parent is killed abruptly (Stop the
  parent, and its child survives holding the port). If a backend won't
  bind, check `Get-NetTCPConnection -LocalPort 8000` (or 8001/8002) for the
  owning PID and stop that specific process, not just the terminal you
  started it from.
- **Stuck on the login screen even with the right password, or seeing 401s
  after it worked before** — if `HUB_PASSWORD`/`SESSION_SECRET` is set
  locally and you change `SESSION_SECRET` (or restart a backend with a
  different value than the others), previously-issued tokens stop
  verifying. Clear the stored token (`localStorage.removeItem("hub:session-token")`
  in the browser console, or just log in again) and make sure all three
  `.env` files have the exact same `SESSION_SECRET`.
- **Are the old standalone frontends still there?** RosterManager and
  class_grads' still exist and still work independently (each on their own
  backend port + `5173`), but the hub is now the primary way to use them
  day to day. Unit Projects has no standalone frontend at all — hub-only.

## Shared visual theme

Both apps use a dark/gold 7cav.us-derived palette already; the hub adds a
sidebar shell around them using the same palette (`hub/src/index.css`).
Each mounted app keeps its own internal CSS scoped so the two don't bleed
into each other — RosterManager's theme is scoped under a `.roster-app`
wrapper class (`hub/src/roster/roster.css`) since its original CSS used
global `:root`/`#root` selectors that would otherwise leak into the shell.
