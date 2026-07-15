# Deploying the 7Cav Apps Hub (Render, free tier)

Three services, all on Render's free plan, all deployed from this same
GitHub repo (`jwill485/A2026Projects`). No credit card required for the
free plan as of this writing.

Suggested service names below (`roster-backend`, `grads-backend`,
`7cav-hub`) — using these exact names means their URLs are predictable
(`https://<name>.onrender.com`), so you can fill in every cross-reference
below in one pass instead of circling back. If a name is taken, Render
appends a random suffix — just use whatever URL it actually shows you.

## Before you start

Have your `MILPACS_API_KEY` value handy (from either project's local
`.env` file) — you'll paste it into Render's dashboard, not into any file
in this repo.

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

## 3. Hub frontend

**New +** → **Static Site** → same repo again.

- **Name**: `7cav-hub`
- **Root Directory**: `hub`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **Environment variables** (build-time):
  - `VITE_ROSTER_BACKEND_URL` = `https://roster-backend.onrender.com`
  - `VITE_GRADS_BACKEND_URL` = `https://grads-backend.onrender.com`

## 4. Verify

Once all three finish building, open the hub's URL
(`https://7cav-hub.onrender.com`). If a route shows "Failed to load,"
double-check the actual assigned URLs in each service's dashboard page
match what you entered above exactly (Render will have appended a suffix
instead of your chosen name if it was taken) — fix any mismatch and the
affected service(s) will redeploy automatically when you save.

## What to expect on the free plan

- **Cold starts**: web services sleep after ~15 minutes idle; the first
  request after that takes 30-60 seconds to wake up. Normal, not a bug.
- **`class_grads/backend/data/groups.json` is not persistent.** Free web
  services have no persistent disk, so Custom Groups created after
  deploying can be lost on the next redeploy or cold restart. Fine for a
  small trusted audience (just recreate the group if it happens); a real
  fix means either upgrading that service off the free plan (Render's
  persistent disks require a paid plan) or moving group storage to an
  external free database. Not done here.
- **No login/auth.** Anyone with the hub URL can use both apps, including
  creating/editing/deleting Custom Groups in Course Graduations
  (RosterManager's backend is read-only, so it's lower risk). Fine for a
  link shared only with people you trust; revisit before sharing more
  widely.
- **RosterManager's saved rosters are per-browser** (`localStorage`, not
  server-side) — each visitor gets their own independent copy, not a
  shared saved state. Everyone still sees the same *live* roster pull;
  only manual edits/splits are local to whoever made them.

## Updating the deployment later

Render redeploys automatically on every push to `master`. No manual step
needed beyond the initial setup above.
