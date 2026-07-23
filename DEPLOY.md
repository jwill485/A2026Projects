# Deploying the 7Cav Apps Hub (Render, free tier)

Four services, all on Render's free plan, all deployed from this same
GitHub repo (`jwill485/A2026Projects`). No credit card required for the
free plan as of this writing.

Suggested service names below (`roster-backend`, `grads-backend`,
`projects-backend`, `7cav-hub`) — using these exact names means their URLs
are predictable (`https://<name>.onrender.com`), so you can fill in every
cross-reference below in one pass instead of circling back. If a name is
taken, Render appends a random suffix — just use whatever URL it actually
shows you.

## Before you start

- Have your `MILPACS_API_KEY` value handy (from either project's local
  `.env` file) — you'll paste it into Render's dashboard, not into any file
  in this repo.
- Decide on a `HUB_PASSWORD` (the password whoever you share the link with
  will type in) and generate a `SESSION_SECRET` — a long random string, e.g.
  from a terminal: `python -c "import secrets; print(secrets.token_hex(32))"`.
  Both get pasted into **all three backend services'** environment
  variables below, with the exact same values in each (the login gate is
  stateless — any backend can issue a session token, and all three verify
  it independently against the same `SESSION_SECRET`, so they must match).

## 1. RosterManager backend

Render dashboard → **New +** → **Web Service** → connect this repo.

- **Name**: `roster-backend`
- **Root Directory**: `RosterManager/backend`
- **Runtime**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Free
- **Environment variables**:
  - `MILPACS_API_KEY` = *(paste your key)*
  - `ALLOWED_ORIGIN` = `https://7cav-hub.onrender.com`
  - `HUB_PASSWORD` = *(your chosen password)*
  - `SESSION_SECRET` = *(your generated random string)*

## 2. Course Graduations backend

**New +** → **Web Service** → same repo again.

- **Name**: `grads-backend`
- **Root Directory**: `class_grads/backend`
- **Runtime**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Free
- **Environment variables**:
  - `MILPACS_API_KEY` = *(paste your key)*
  - `ALLOWED_ORIGIN` = `https://7cav-hub.onrender.com`
  - `HUB_PASSWORD` = *(same value as above)*
  - `SESSION_SECRET` = *(same value as above)*

## 3. Unit Projects backend

**New +** → **Web Service** → same repo again.

- **Name**: `projects-backend`
- **Root Directory**: `unit_projects/backend`
- **Runtime**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Plan**: Free
- **Environment variables**:
  - `ALLOWED_ORIGIN` = `https://7cav-hub.onrender.com`
  - `HUB_PASSWORD` = *(same value as above)*
  - `SESSION_SECRET` = *(same value as above)*

## 4. Hub frontend

**New +** → **Static Site** → same repo again.

- **Name**: `7cav-hub`
- **Root Directory**: `hub`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **Environment variables** (build-time):
  - `VITE_ROSTER_BACKEND_URL` = `https://roster-backend.onrender.com`
  - `VITE_GRADS_BACKEND_URL` = `https://grads-backend.onrender.com`
  - `VITE_PROJECTS_BACKEND_URL` = `https://projects-backend.onrender.com`

## 5. Verify

Once all four finish building, open the hub's URL
(`https://7cav-hub.onrender.com`). You should land on a password prompt —
enter the `HUB_PASSWORD` you set above. If a route shows "Failed to load"
after logging in, double-check the actual assigned URLs in each service's
dashboard page match what you entered above exactly (Render will have
appended a suffix instead of your chosen name if it was taken) — fix any
mismatch and the affected service(s) will redeploy automatically when you
save.

## What to expect on the free plan

- **Cold starts**: web services sleep after ~15 minutes idle; the first
  request after that takes 30-60 seconds to wake up. Normal, not a bug.
- **`class_grads/backend/data/groups.json` and
  `unit_projects/backend/data/projects.json` are not persistent.** Free web
  services have no persistent disk, so Custom Groups and Unit Projects
  created after deploying can be lost on the next redeploy or cold restart.
  Fine for a small trusted audience (just recreate it if it happens); a real
  fix means either upgrading that service off the free plan (Render's
  persistent disks require a paid plan) or moving storage to an external
  free database. Not done here.
- **One shared password, not per-user accounts.** Everyone who knows the
  `HUB_PASSWORD` sees the same login and gets full access to view and edit
  everything (Custom Groups, Unit Projects CRUD, etc.) — there's no
  concept of individual users, roles, or audit trail for who changed what.
  Fine for a small trusted group; revisit before sharing more widely.
  Sessions last 7 days from login, stored in the browser (`localStorage`),
  and don't sync across devices/browsers.
- **RosterManager's saved rosters are per-browser** (`localStorage`, not
  server-side) — each visitor gets their own independent copy, not a
  shared saved state. Everyone still sees the same *live* roster pull;
  only manual edits/splits are local to whoever made them.

## Updating the deployment later

Render redeploys automatically on every push to `master`. No manual step
needed beyond the initial setup above.
