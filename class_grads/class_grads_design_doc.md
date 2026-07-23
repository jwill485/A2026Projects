# Class Grads — Design Document

## 1. Product Overview

**Purpose:** A tool for tracking training-class graduations across the 7th
Cavalry Regiment — 1-7, 2-7, 3-7, the ACD holding pool, and every other
active-duty billet (Regimental Staff, section staff, DEVCOM). Started as a way
to just pull a list of who's graduated what; the eventual goal is a real
class-graduation tracking system for the battalion, including tracking
qualification for the WW2 Ranger Selection Requirement.

**Primary User:** Battalion leadership wanting to see who's completed which
courses, and to check WW2 Ranger Selection Requirement qualification.

**Key Value:** One place to see graduation history and Ranger Selection
progress per trooper, pulled live from the 7Cav API, without digging through
individual milpacs profiles by hand.

**Status:** V1 built — live-data viewer with filtering/sorting, WW2 Ranger
Selection Requirement tracking, and user-defined Custom Requirement Groups
(the app's first bit of persistent state — everything else is a fresh live
pull every load). Not deployed beyond localhost.

---

## 2. Architecture (Built)

Same two-piece local shape as RosterManager, sharing its `MILPACS_API_KEY`
`.env` convention (each project keeps its own copy of the key — see
RosterManager's `HOW_TO_USE.md` for why a shared key across projects is
fine).

- **`backend/`** — FastAPI app (`app/main.py`). Holds `MILPACS_API_KEY`
  server-side so it never reaches the browser. On each request to
  `/api/graduations`, it calls the 7Cav API's **full** (non-`/lite`) roster
  endpoint (`/roster/ROSTER_TYPE_COMBAT`) and the `/milpacs/ranks` endpoint
  (for real rank-seniority ordering) concurrently, classifies and filters
  profiles, and returns a per-member payload (name, rank + rank order,
  battalion, company, tier, echelon, MOS, graduations, Ranger Selection
  status).
- **`backend/app/ranger.py`** — WW2 Ranger Selection Requirement matching:
  the 14 canonical Hell Let Loose class names plus a curated alias list for
  wording variants found in the live data. See §4.2 below.
- **`backend/app/groups_store.py`** + **`backend/data/groups.json`** —
  persistence for user-defined Custom Requirement Groups (§4.6). Plain JSON
  file, read/written on every `/api/groups` CRUD call; gitignored (local
  instance data, not source).
- **`frontend/`** — React/Vite SPA (`src/App.tsx`). Fetches
  `/api/graduations` on load, renders a filterable/sortable/expandable
  table. No local state persistence — every page load is a fresh live pull.
- **`src/pullGraduations.ts`** (repo root, Node/TS) — standalone CLI script,
  independent of the backend/frontend (talks to the 7Cav API directly, not
  through the FastAPI backend). Same scope/classification, WW2 Ranger
  Selection Requirement matching (`src/ranger.ts`, mirroring
  `backend/app/ranger.py`), and Custom Group status (`src/groups.ts`,
  mirroring `groups_store.py` + `compute_group_status()`, reading the same
  `backend/data/groups.json`) as the web app — added 2026-07-15, see §4.7.
  Written to `output/graduations.json` / `.csv` for a point-in-time
  snapshot.

**Scoping logic** (`classify_position()` in `backend/app/main.py`, mirrored
in `src/scope.ts` as `classifyPosition()` for the CLI script): a profile
counts as in-scope if its *current primary position* is anywhere in 1-7,
2-7, 3-7 (Battalion HQ or any company/platoon/squad), the ACD holding pool
(its own A/B/C/D companies), or — as of 2026-07-15 — any other active-duty
billet: Regimental Staff, S1/S2/S6, MP, WAG, RRD, RDC, and DEVCOM, all
bucketed under a synthetic **"Regiment"** battalion whose "companies" are
those sections rather than lettered companies (DEVCOM keeps its internal
platoon/squad structure but surfaces as company "DEVCOM," not "D"). Those
titles use ad hoc naming (1IC/2IC/Lead/Senior Investigator/...) rather than
line units' Commander/XO/1SG grid, so each is mapped individually
(`REGIMENT_SECTION_ROLES`) and its tier is derived from actual rank
(`rankDisplayOrder` from `milpacs/ranks`, bucketed into
officer/seniorNco/juniorNco/trooper) rather than guessed from the title.
"New Recruit," test accounts, and Reserve titles remain excluded by
construction — their position titles don't match any known pattern.
Widened from 2-7-only to the whole regiment 2026-07-14, then from
line-battalions-only to every active-duty billet 2026-07-15; kept
deliberately identical between the backend and the CLI script so the two
never disagree on membership.

---

## 3. Data Notes (7Cav API)

- The `/lite` roster endpoint (what RosterManager uses) has **no**
  graduation data. Only the full endpoint's `records[]` array does.
- `records[]` mixes several `recordType`s (promotions, transfers,
  discipline, ELOA, discharges, graduations, ...) — only
  `RECORD_TYPE_GRADUATION` entries are graduations.
- There's no structured class ID/name field — `recordDetails` is free text
  written by whoever logged the record, and it's inconsistent: the same
  course shows up under multiple wordings over the years (typos, reordered
  words, old naming — e.g. "Anti Tank Course" / "Anti-Tank Course",
  "Advanced Infantry Training 1 Course" / "Advanced Infantry Tactics I").
  `ranger.py`'s alias list documents the variants found so far.
- Rank ordering needs the separate `/milpacs/ranks` endpoint
  (`rankDisplayOrder` field) — the roster endpoint's `rank.rankId` alone
  isn't sortable into real military seniority.
- The full roster payload is large (~15MB, whole-regiment) — filtering
  happens server-side/script-side, not in the browser.

---

## 4. Core Features (Built)

### 4.1 Table, search, sort

- Live table of all in-scope members: Name, Rank, Battalion, Company,
  Position, MOS, graduation count, and a **Prerequisites** column (`X/N`
  badge) reflecting whichever prerequisite set is currently selected — see
  §4.2.
- Click any column header to sort by it (ascending, click again for
  descending). Rank sorts by real military seniority via
  `/milpacs/ranks`'s `rankDisplayOrder`, not alphabetically. The
  Prerequisites column sorts by completion count for the currently
  selected set.
- Click a row to expand it: graduation history (date + description), full
  WW2 Ranger Selection Requirement status, and every Custom Group's status
  — all shown together regardless of which one is selected in the table's
  Prerequisites column/filter (the detail view is comprehensive; the
  column/filter is the single-set-at-a-time summary view).
- Search bar matches name, username, rank, MOS, battalion, position, and
  any graduation's text.

### 4.2 Prerequisite sets (WW2 Ranger Selection Requirement + Custom Groups)

Reworked 2026-07-14: the table's requirement-tracking column and its filter
are unified into one **"Prerequisite set"** selector, rather than one fixed
Ranger-Selection-only column plus a separate custom-group filter mechanism.
The built-in WW2 Ranger Selection Requirement is just the first entry in
that selector (fixed id `"ranger"` on the frontend, see `RANGER_ID` in
`App.tsx`) — any Custom Group (§4.6) appears alongside it and can be picked
the same way.

- **WW2 Ranger Selection Requirement** itself is unchanged under the hood:
  a trooper qualifies once they've graduated all 14 of a specific set of
  Hell Let Loose classes (full list in project memory —
  `class-grads-ww2-ranger-selection`). `backend/app/ranger.py` normalizes
  case/whitespace/hyphenation/apostrophes, maps each canonical class to
  known wording variants found live, and always requires "Hell Let Loose"
  in the record text so a similarly-named class from a different game never
  counts. This stays its own specialized module — it is *not* implemented
  as a Custom Group under the hood, only presented as one option among
  several in the same selector.
- **Frontend unification** (`App.tsx`): `prereqStatusFor(member, id)`
  normalizes both `member.ranger` and a `member.groups[]` entry into one
  shape (`{requiredTotal, requiredCompleted, missing, qualified}`), so the
  column, badge, sort, and filter code only has one shape to deal with
  regardless of which set is selected.
- **Filter**: "Prerequisite set" (pick WW2 Ranger Selection Requirement or
  any Custom Group) + "Status" (All / Qualified / Not qualified / Close —
  missing ≤ 3). Picking a different prerequisite set defaults Status to
  "Not qualified" — the useful default when you've just picked a
  requirement you want to track completion against (fixed 2026-07-14 after
  the original two-dropdown Custom Group filter defaulted to "All" and
  silently showed everyone, which read as "the filter doesn't work").

### 4.3 Filters

Battalion, Company, Rank tier, Graduated class (dynamic dropdown of every
distinct class name in the data), and Prerequisite set + Status (§4.2) —
all combine with each other and the search bar. "Clear filters" appears
whenever any are active.

### 4.4 Branding

7cav.us's own color palette (near-black background, cavalry-gold accent,
sampled from the live site's stylesheet) and the 1st Cavalry Division patch
in the header — the app looks like it belongs to the regiment rather than a
generic tool.

### 4.6 Custom Requirement Groups

For units that don't do WW2 Ranger Selection but want the same
"named-qualification with a badge, missing-list, and filter" mechanic for
their own set of classes. Deliberately kept **separate** from `ranger.py`
rather than generalizing Ranger Selection itself — Ranger Selection's
alias-tolerant matching is specific, tuned engineering; custom groups use
plain exact-string matching against the same live class-text list, with the
option to pick multiple text variants per requirement if a unit wants that
tolerance too.

- **Storage**: `backend/data/groups.json`, shared across everyone hitting
  the backend — not per-browser. `GET/POST/PUT/DELETE /api/groups`.
- **Shape**: a group has a name and a list of requirements; each requirement
  has a label and one-or-more `acceptedClasses` (exact strings from the
  known class list). A member satisfies a requirement if they have *any*
  graduation whose text is in `acceptedClasses`.
- **Editor** (`GroupEditor.tsx`): name field, repeatable requirement rows,
  each with a label input and a filterable checkbox list of every known
  class (`ClassMultiPicker`). Save disabled until every requirement has a
  label and at least one selected class.
- **Panel** (`GroupsPanel.tsx`): list existing groups (Edit/Delete with
  inline confirm) or create a new one. Opened via the "Manage Groups" button
  in the filter bar.
- **Per-member status** computed server-side in the same `/api/graduations`
  response (`compute_group_status()` in `main.py`) — every member gets a
  `groups[]` array with one entry per stored group (qualified or not),
  mirroring `ranger`'s shape.
- **Filter/column**: selectable via the shared "Prerequisite set" dropdown
  alongside WW2 Ranger Selection Requirement — see §4.2 (originally its own
  separate "Custom Group" + "Group status" filter, unified 2026-07-14).
- **Detail view**: expanding a row shows a "Custom Groups" section below
  Ranger Selection, listing every group's status for that member (skipped
  entirely if no groups exist yet) — unaffected by which one is selected in
  the table column/filter.

Mirrored into the CLI pull script as of 2026-07-15 — see §4.7.

### 4.7 CLI snapshot

`npm run pull` (repo root) writes `output/graduations.json` / `.csv` — same
scope, WW2 Ranger Selection Requirement status, and Custom Group status as
the web app, useful for spreadsheet work. The CSV gets one column per
Custom Group (by name) plus `RangerCompleted`/`RangerTotal`/
`RangerQualified`; Battalion and group-status values are apostrophe-guarded
against Excel's date coercion, the same fix applied to the web app's own
"Export CSV" button (which exports only the current filtered/sorted table
view, not a full snapshot). Doesn't require the backend running.

---

## 5. Open follow-ups from this round

- The WW2 Ranger Selection Requirement alias list in `ranger.py` involved
  judgment calls about which wording variants are "the same" course (e.g.
  "Machine Gun Course" = "Machine Gunner Course"). Worth a sanity check by
  someone who knows the course history.
- Regimental Staff/S1/S2/S6/MP/WAG/RRD/RDC/DEVCOM tier is derived from rank
  rather than title (2026-07-15, since those titles don't follow line units'
  Commander/XO/1SG convention) — worth a sanity check that the
  officer/seniorNco/juniorNco/trooper rank-order cutoffs in
  `_tier_from_rank_order` land where leadership would expect for warrant
  officers and "1IC/2IC/Lead" roles specifically.
- ~~`backend/data/groups.json` is a single unguarded file with no auth on
  the `/api/groups` write endpoints~~ — resolved 2026-07-22, see
  [§7](#7-broader-vision-unit-management-app): `/api/groups` (like every
  other write endpoint across all three backends) now sits behind the
  shared-password login gate when `HUB_PASSWORD`/`SESSION_SECRET` are set.

## 6. Planned / Future Ideas

### 6.1 Local tracking (not just live view)

Original ask was "a way to track class graduations" — the current app is
read-only against live milpacs data. A real tracking system implies
something milpacs doesn't give us for free, e.g.:
- Manually logging a graduation before/independent of it landing in milpacs
  (useful if there's a lag between an in-game class and the record being
  entered).
- Flagging/annotating members (e.g. "signed up for next Sniper Course
  cohort") — planning metadata with no milpacs equivalent.
- Historical snapshots — has anyone's graduation list *changed* over time
  (new grad, or a correction)?

None of this is designed yet — needs its own scoping conversation once V1
(live viewer) has been used for a while and gaps become concrete.

### 6.2 Battalion-scoped company filter

Right now Company (A/B/C/D/E/HQ) and Battalion filter independently, so
picking Company=A alone mixes A/1-7, A/2-7, A/3-7, and A/ACD together.
Combining both filters gets a precise answer, but the Company dropdown
could instead narrow to only the letters that exist in the currently
selected battalion, if that turns out to matter in practice.

### 6.3 Other possible additions
- ~~Bring Ranger Selection matching into the CLI pull script~~ — done
  2026-07-15 (§4.7), along with Custom Group status and CSV export from the
  web table view itself.
- Deployment beyond localhost, if this becomes something more than one
  person's tool (mirrors RosterManager's same open question).

---

## 7. Broader vision: unit management app

Noted 2026-07-14: class_grads is intended as one piece of a larger app for
unit management, alongside RosterManager. **Compose** was chosen over
**merge** and built 2026-07-15: a third project, `hub/` (see its own
`HOW_TO_USE.md`), is a `react-router-dom` shell that mounts both projects'
existing frontend code under `/roster` and `/grads` routes, unmodified
except for CSS scoping (RosterManager's `:root`/`#root`-based theme is
wrapped under a `.roster-app` class so it doesn't leak into the shell or
class_grads' pages). Each app keeps its own FastAPI backend and its own
data — RosterManager's local-storage rosters/change logs, class_grads'
`groups.json` — nothing about their data models or APIs changed. The two
backends now run on different ports simultaneously (RosterManager 8000,
class_grads 8001) since the hub talks to both at once; each backend's CORS
now allows a range of localhost ports (`517\d`) rather than a fixed one,
since running the hub plus either standalone frontend means Vite's
auto-increment can land on 5174/5175/etc.

Still open, now that the frontend piece is done:

- **Merge vs. stay composed — decided 2026-07-21: stay composed, no shared
  backend code.** Scoped by inventorying all three backends (RosterManager,
  class_grads, unit_projects) factually before deciding (see §7.1 for the
  findings). The deciding factor was deployment: `DEPLOY.md` deploys each
  backend as an **independent Render Web Service**, each with its own
  **Root Directory** (`RosterManager/backend`, `class_grads/backend`,
  `unit_projects/backend`). Any code shared *across* those directories
  (e.g. a top-level `shared/` package) stops being a clean `pip install -r
  requirements.txt` from that Root Directory — it would need extra build
  steps, `PYTHONPATH` hacks, or widening each service's Root Directory to
  the repo root, all of which trade real deploy simplicity for saving a
  couple dozen duplicated lines. Not worth it for a small trusted-audience
  tool. So: `groups_store.py`/`projects_store.py` stay independently
  duplicated (they're tiny), and RosterManager's `buildRoster.ts` stays
  frontend-only and 2-7-scoped rather than getting a ported
  `classify_position()` equivalent — see §7.1 for why that's the right
  call even setting deployment aside.

### 7.1 Merge scoping findings (2026-07-21)

- **RosterManager** (8000) is a thin, read-only 7cav API proxy — no
  Pydantic models, no server-side persistence, no classification logic in
  the backend at all. Its `Soldier` type and battalion/company
  classification (`buildRoster.ts`) live entirely in the frontend, hardcoded
  to battalion 2-7, and shape data as a nested org-chart tree
  (Battalion→Company→Platoon→Squad) because that's what split-planning/drag-drop
  needs. This 2-7 scoping is a deliberate design choice (it's the unit's own
  planning tool), not an oversight to "fix" by widening it — nothing about
  it needs to track class_grads' regiment-wide rules.
- **class_grads** (8001) does a live, opinionated pull+join
  (`ROSTER_TYPE_COMBAT` + ranks) and classifies server-side via
  `classify_position()`, regiment-wide, into a **flat** record (explicit
  `battalion`/`company`/`tier`/`echelon` fields) because it needs to
  filter/group across the whole regiment.
- **unit_projects** (8002) has zero 7cav API dependency and zero overlap
  with the other two beyond boilerplate — no person/soldier concept at all,
  `owner` is a free-text string, not linked to any roster ID.
- The regex classification logic is **similar but diverged, not shared** —
  class_grads' Python regexes were deliberately written to mirror
  RosterManager's TS ones (per class_grads' own source comment), then
  independently widened regiment-wide. Two hand-maintained implementations
  in two different languages (frontend TS vs. backend Python) serving two
  genuinely different scopes (one battalion vs. the whole regiment) — not
  one duplicated file with an accidental fork.
- `groups_store.py` (class_grads) and `projects_store.py` (unit_projects)
  **are** near-identical duplicated boilerplate — same whole-file JSON
  read/write shape, just renamed. Real duplication, but each is ~18 lines
  and each backend deploys from its own isolated Render Root Directory (see
  above) — extracting a shared module would cost more in deploy complexity
  than the duplication itself costs in maintenance.
- CORS, `requirements.txt` versions, and the `MILPACS_API_KEY`/
  `MILPACS_BASE_URL` pattern (where used) are already fully consistent
  across all three — no drift found there, nothing to do.

**Decision: no backend/data-model merge, no cross-service shared code
module.** RosterManager's tree-shaped model and class_grads' flat
regiment-wide model each fit their own app's actual UI and actual scope;
unit_projects has nothing to merge in; and Render's per-service Root
Directory deploy model makes cross-service code sharing a net cost, not a
saving, at this project's size. Revisit only if a service ever needs
logic genuinely identical to another's *and* deployment moves off this
per-directory Render model (e.g. a single monolith deploy or a published
internal package) — neither is true today.

- ~~Auth~~ — built 2026-07-22, ahead of the first deployed demo. Single
  shared password (`HUB_PASSWORD`), not per-user accounts — the earlier
  "tabled unless a future update makes it critical" note (2026-07-21)
  turned out to be immediately critical, since deploying anything publicly
  needed *some* gate first. Design: each backend gets a small duplicated
  `auth.py` (`RosterManager/backend/app/auth.py`, and identically in
  class_grads' and unit_projects'), consistent with the "duplicate rather
  than share across Render's per-service Root Directories" call made
  above. `/api/login` checks the password and issues a stateless
  HMAC-signed token (`{expiry}.{hmac_sha256(SESSION_SECRET, expiry)}`,
  7-day TTL); a `require_session` FastAPI dependency guards every other
  route; `/api/session` lets the hub check token validity without hitting
  a protected route. Because verification only needs the shared
  `SESSION_SECRET` (no shared database or cross-service call), a token
  issued by any one backend is accepted by all three. **Opt-in**: if
  `HUB_PASSWORD`/`SESSION_SECRET` aren't set (the local-dev default), auth
  is fully disabled and every route behaves exactly as before this existed
  — verified via Playwright in both states. The hub (`hub/src/auth.ts`,
  `LoginScreen.tsx`) gates the whole shell behind a login screen and
  attaches the session token to every API call via an `authFetch` wrapper
  used in `roster/lib/api.ts`, `GradsApp.tsx`, and `ProjectsApp.tsx`. Not
  pursued: per-user accounts/attribution, rate-limiting or lockout on
  `/api/login` — fine for a small trusted-audience demo, revisit if that
  changes. See `DEPLOY.md` and `hub/HOW_TO_USE.md` for the operational
  setup (env vars, testing the gate locally).
- **What RosterManager gets from this direction**: a live class-completion
  view alongside its roster/split-planning tools. **What class_grads gets**:
  RosterManager's multi-roster/planning concepts, if qualification tracking
  ever needs to feed into "who's eligible to be assigned where."
- **Are the standalone frontends still needed?** `RosterManager/frontend`
  and `class_grads/frontend` are untouched and still fully functional on
  their own — the hub only added a third project, it didn't remove
  anything. Worth deciding at some point whether to keep maintaining both
  entry points or retire the standalone ones now that the hub covers the
  same ground.
