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
  independent of the backend/frontend. Same fetch+filter+extract logic
  (battalion/company only — no Ranger Selection matching yet, see
  [§6.3](#63-other-possible-additions)), written to `output/graduations.json`
  / `.csv` for a point-in-time snapshot.

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

Not yet mirrored into the CLI pull script — see
[§6.3](#63-other-possible-additions).

### 4.7 CLI snapshot

`npm run pull` (repo root) writes `output/graduations.json` / `.csv` — same
scope as the web app, useful for spreadsheet work. Does not yet include
Ranger Selection status (see [§6.3](#63-other-possible-additions)).

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
- `backend/data/groups.json` is a single unguarded file with no auth on the
  `/api/groups` write endpoints — fine for one trusted local user, not fine
  if this ever runs somewhere multiple people can reach it unauthenticated.
  Worth revisiting alongside [§7](#7-broader-vision-unit-management-app).

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
- Bring Ranger Selection matching into the CLI pull script too, so
  `output/graduations.csv` carries the same qualification data as the web
  app.
- CSV import/export parity with the table view (right now only the CLI
  script produces CSV, and without Ranger Selection columns).
- Deployment beyond localhost, if this becomes something more than one
  person's tool (mirrors RosterManager's same open question).

---

## 7. Broader vision: unit management app

Noted 2026-07-14: class_grads is intended as one piece of a larger app for
unit management, alongside RosterManager. Not designed yet — this is a
placeholder to capture the intent, not a commitment to a shape. Things
worth thinking through whenever that conversation actually happens:

- **Merge vs. compose.** Would RosterManager and class_grads become one
  codebase (shared backend, shared frontend shell with multiple views), or
  stay separate apps that share conventions (both already do: the
  `MILPACS_API_KEY` `.env` pattern, FastAPI + React/Vite, similar
  scoping-logic structure)? A shared backend would mean one FastAPI app
  exposing both roster-management and class-tracking endpoints; composing
  would mean two backends a future shell app talks to.
- **Auth**, if this ever serves more than one trusted person on one
  machine — right now neither app has any (RosterManager's `.env` even has
  an unused `JWT_SECRET`, suggesting this was anticipated). Directly
  relevant to the `groups.json` write-endpoint concern in
  [§5](#5-open-follow-ups-from-this-round).
- **Shared domain logic.** Both projects independently derive
  battalion/company/tier from `positionTitle` regexes (RosterManager's
  `buildRoster.ts`, class_grads' `main.py` + `scope.ts`) — three
  implementations of the same rules today. A real merge would want one
  shared source of truth instead of three copies kept manually in sync by
  convention.
- **What RosterManager gets from this direction**: a live class-completion
  view alongside its roster/split-planning tools. **What class_grads gets**:
  RosterManager's multi-roster/planning concepts, if qualification tracking
  ever needs to feed into "who's eligible to be assigned where."

No action items yet — surface this doc (or [§4.6](#46-custom-requirement-groups)'s
`groups.json` approach specifically) when that design conversation happens.
