# Battalion Roster Management System - Design Document

## 1. Product Overview

**Purpose:** A web-based roster management tool for organizing and visualizing
battalion structure in the 2-7 Cavalry Regiment. Lets leadership map,
organize, and manage personnel assignments across the hierarchical unit
structure — either live against the real 2-7 roster, or in isolated
what-if/planning rosters (e.g. working out the upcoming battalion split)
without touching the real data.

**Primary User:** Battalion CO and subordinate leaders managing personnel
assignments, roster changes, and command structure.

**Key Value:** A single visual tool for both day-to-day roster maintenance
(against the real, live 2-7 data) and structural planning (multiple
independent named rosters, seeded from the live roster or built from
scratch), with a full audit trail of what changed and why.

**Status:** Built and in active use for local/personal iteration. Not yet
deployed anywhere beyond localhost — see [§6.5](#65-deployment-status) for
what that would take.

---

## 2. Core Features (Built)

### 2.1 Multiple Named Rosters
The app holds any number of independent rosters at once, not just one
"current" roster. Each is fully separate: its own troopers/structure, its own
saved baseline, its own change log. A picker in the top bar lets you:
- Switch between rosters instantly (no data loss — everything persists per
  roster as you go).
- Create a new roster (**+ New Roster**), either blank or a duplicate of the
  currently active one.
- Rename a roster and/or tag it with a **Configuration**: untagged, **Old**
  (pre-split), or **New** (post-split) — see [§2.9](#29-battalion-split-support).
- Delete a roster (blocked if it's the only one left).

The very first run auto-creates one roster ("2-7 Cavalry Battalion") from the
live API. Anyone upgrading from an older single-roster version of the app has
their existing data automatically migrated into a named roster on first load.

### 2.2 Hierarchical Roster View
Read-only tree view (the **Battalion Roster** tab): Battalion HQ → Companies
→ Platoons → Squads → troopers, expandable/collapsible, plus a separate
Unassigned pool. Vacant billets show a **VACANT** label; each level shows a
headcount badge.

### 2.3 Drag-and-Drop Assignment
The **Drag & Drop** tab shows the same tree as two side-by-side, independently
selectable panes ("Kanban" style):
- **Other (left)** — any company, or Unassigned.
- **Building (right)** — same options; this is also where newly
  added/imported troopers land, so point it at whatever you're currently
  populating. (You can point both panes at the same company if you just want
  one big single-pane view.)

Dragging a trooper onto an occupied billet is **blocked** (no swap/bump) —
move or remove the current occupant first. Troopers show small ✎ (edit) and
✕ (delete) affordances alongside their name.

**Click-to-assign** is the low-friction alternative to dragging
(`CandidatePicker.tsx`): every vacant billet is a clickable button, and each
squad's member list ends with a **+ assign trooper** affordance. Clicking
opens a modal picker listing candidates filtered to the leadership tier the
billet draws from (officers for CO/XO/PL, senior NCOs for SGM/1SG/PSG,
junior NCOs for Squad Leader, everyone for members — same `leadership.ts`
tiers as the Split Planner), rank-sorted with pool members first, each row
showing MOS, current location, and squad practice time, with a search box
and a **Show all ranks** escape hatch. One click places the person through
the same `moveSoldier` path as a drag. Dragging still works everywhere —
the button sits inside the droppable.

A squad can also be dragged as a whole unit via its **⠿ Squad N** handle in
the summary line, dropped onto any platoon's **squad-list drop zone** (a
persistent "Drop a squad here" strip below that platoon's squads, since the
gaps between existing squad cards are too thin to reliably target). Moves
the leader and every member together; if the destination platoon already
has a squad using that number, the incoming one is auto-renumbered (same
next-available scheme as **+ Add Squad**) rather than colliding.

### 2.4 Trooper Management
Add, edit, and delete troopers directly (name, rank — selected from the
7Cav rank list, MOS). New troopers land in the **Building** pane. Editing
changes name/rank/MOS in place without moving the trooper; rank changes
re-sort them within their squad.

### 2.5 Structure Management
Add companies (short code + name, e.g. `D` / "Dog"), platoons, and squads to
the active roster. Platoons and squads can also be removed via a small ✕ next
to their name in Drag & Drop — but only while empty (no leader/sergeant, and
for a platoon, none of its squads have anyone either); the button is disabled
with an explanatory tooltip otherwise, so removing one never silently deletes
troopers. Still no delete for companies — an unused empty one is harmless and
can just be left.

### 2.6 Live 7Cav API Import
Three ways to pull real people into any roster, without ever writing back to
the live 7Cav API:
- **Refresh from API** — rebuilds the *active* roster from the live 2-7 data
  (destructive to that one roster; confirmed first).
- **+ Import Trooper** — a searchable picker of every real trooper currently
  in 2-7 + B/ACD; adds one at a time into the Building pane.
- **+ Import Company** — pulls a whole company (Able/Baker/Charlie/Easy, or
  the B/ACD/Unassigned group) into the active roster in one action, platoons
  and leadership intact. Importing the B/ACD group merges into the
  destination roster's own Unassigned pool (every roster already has one) —
  it never creates a second Unassigned pane. Troopers already present
  elsewhere in the destination roster are silently skipped rather than
  duplicated.

Every imported trooper remembers their original billet at import time (see
§2.7) — this is separate from, and doesn't overwrite, wherever they get
dragged to afterward.

### 2.7 Change Log / Audit History
**Save Changes** diffs the active roster against its last-saved baseline and
appends a timestamped entry describing every move ("who moved from → to").
For a trooper who's newly present since the baseline, the entry shows **where
they came from** (their billet in the live roster at import time) instead of
a bare "(new)"; manually-created troopers (no live origin) still show "(new)".
Each entry can be copied as text or deleted individually; the whole log can
be cleared. **Revert Changes** discards everything since the last save.

### 2.8 Analytics
Charts (toggleable to plain data tables) for the active roster: leadership
fill rate by company, headcount by company, MOS breakdown, and a plain-list
vacancy report of every open leadership billet.

### 2.9 Battalion Split Support
2-7 is expected to eventually split into two battalions (working names
**HLLV** / **HLLWW2**). Rather than a new data-model concept, this is built
on top of Multiple Named Rosters (§2.1): the live roster stays as-is (tagged
**Old**), and each new battalion ends up as its own separate roster (tagged
**New**). The Battalion Roster tab shows a colored **"Viewing: Old/New
Configuration"** badge based on the active roster's tag, so it's always
clear which one is in view. See [§8.1](#81-battalion-split-2-7--two-battalions)
for the fuller history of this decision.

The split is driven by a guided, five-phase workflow on the **Split
Planner** tab (`SplitPlanner.tsx`) — the app's default landing tab — soft
guidance with progress tracking, not a locked wizard; every other tool
stays usable throughout:

1. **Sort** — every trooper gets a small **N / HLLV / HLLWW2** toggle (next
   to their name on both the Battalion Roster tree and Drag & Drop) marking
   them Neutral (undecided) or assigned to one of the two new battalions,
   right on the *existing* live roster. Tagging doesn't count as a "pending
   change" (it's not part of `diffRosters`), so it never blocks
   Save/Org Chart/etc. The phase card's **Start sorting (N to go)** button
   jumps to the Battalion Roster tree with the filter bar's **split tag**
   dropdown (see [§2.12](#212-search--filter)) pre-set to Neutral, turning
   the tree into a work queue — troopers drop out of view as they're tagged.
   Tags can also be bulk-applied from a file via **Import tags from CSV…**
   on the same phase card (`splitTagImport.ts`): two columns per line —
   trooper, then `N`/`HLLV`/`HLLWW2` — split on comma/semicolon/tab, extra
   columns ignored, a non-matching first line skipped as a header. Troopers
   are matched by username first (the unique MILPACS handle), then by real
   name as a fallback; a real name shared by several troopers is skipped as
   ambiguous rather than guessed at. An inline summary reports applied /
   not-found / ambiguous / unreadable lines. A **🎲 Random tags (test)**
   button (confirm-gated, since it overwrites every tag) coin-flips
   everyone onto HLLV or HLLWW2 — a test helper for exercising the later
   phases without doing the real sort first. A **Send Charlie Company
   (C/2-7) to HLLV intact** checkbox (`RosterData.sendCharlieToHllv`,
   `INTACT_TRANSFER` in `splitReorg.ts`) short-circuits sorting for that
   company: checking it tags all of C's members **and the B/ACD pool's**
   HLLV immediately (B/ACD is currently the real home of Charlie's people
   while the live Charlie shell is empty, so it's treated as stored under
   C/2-7 for this transfer). On commit, `buildSplitRoster` folds B/ACD's
   platoons in under Charlie's own (renumbered past Charlie's own platoon
   numbers, same next-available scheme as `+ Add Platoon`) and carries the
   merged company — structure, leadership, practice times — into HLLV's
   battalion as one unit, both groups bypassing every pool entirely
   (regardless of any individual re-tags). The toggles (and these
   buttons) are hidden entirely on rosters tagged **New** — tagging only
   means something on the source roster.
2. **Practice times** — asks one question: accept the current practice
   times, or edit them first? **Accept** fills every blank squad with the
   known real 2-7 schedule (`practiceDefaults.ts` — e.g. all of Able at
   THU 2359z, Baker by platoon, Easy and the B/ACD pool by squad) and
   signs the set off in one click. **Edit** expands a per-squad table —
   the active roster's current squads including the Unassigned pool's,
   grouped by company, each row showing the squad's MOS makeup
   (via `computeSquadMos`) beside a free-text time input, pre-filled with
   the same defaults — and **Save practice times** signs off and
   collapses it. The sign-off is `RosterData.practiceTimesConfirmed`;
   editing any time clears it until the next save. Times are stored as
   `Squad.practiceTime` (`setSquadPracticeTime` in `moveSoldier.ts`); like
   `splitStatus`, all of this is planning metadata invisible to
   `diffRosters`, so it never counts as a pending change. Squads moved
   whole (§2.3) carry their practice time with them. The point: the Unit
   Builder step can keep squads that train together — or share a
   specialty — intact.
3. **Review leadership** — the planner buckets each battalion's tagged pool
   into **Officers / Senior NCOs / Junior NCOs / Troopers** (classified by
   rank in `leadership.ts`), each annotated with the billets that tier
   feeds (officers → CO/XO/PL, senior NCOs → SGM/1SG/PSG, junior NCOs →
   Squad Leader). A zero in a leadership tier is flagged red — the cue to
   re-balance tags before committing. Ends with an explicit **Accept
   leadership review** button (`RosterData.leadershipAccepted`); changing
   anyone's split tag afterwards — toggle, CSV import, or the random-tag
   test button — clears the acceptance, since the review no longer
   reflects the tags.
4. **Commit Split** — locked until three gates pass, shown as a blocker
   list under the button while any fail: zero undecided troopers (phase
   1), practice times accepted (phase 2), and leadership review accepted
   (phase 3). Generates (or, on re-run, overwrites) the two
   `HLLV`/`HLLWW2` rosters. Deliberately does **not** carry the old 2-7
   structure over: each new roster is an **empty battalion** (designation =
   battalion name, HQ vacant, no companies) with everyone tagged for it in
   the Unassigned pool, sorted by rank, split tags cleared. Structure gets
   built deliberately in phase 5 around the leadership actually available.
5. **Unit Builder** — per battalion, the planner tracks HQ fill (x/3),
   companies created, company-leadership fill, and pool remaining, with an
   **Open in Drag & Drop** button that switches roster + tab in one click.
   Each battalion card also shows a **💡 Suggested structure**
   (`buildSuggestions.ts`): old squads kept intact as units, clustered by
   practice time into proposed companies, each squad annotated with its
   source (e.g. "from A/1/2"), headcount, and MOS makeup. Sizing follows
   each battalion's structure standards (`STRUCTURE_RULES`) rather than a
   fixed shape:

   | | min squads/platoon | min platoons/company | company count |
   |---|---|---|---|
   | **HLLV** (priority battalion) | 2 | 2 | up to 4 |
   | **HLLWW2** | 2 | 2 | 1–2 |

   Company count is the flexible lever: it's the largest value that (a)
   the tagged squad count can support at minimum size, (b) available
   leadership can staff (each company needs 1 CO + 1 1SG, each of its
   platoons 1 PL + 1 PSG — officers and senior NCOs are counted from the
   tagged pool and the tighter of the two caps the result), and (c) the
   battalion's own cap (4 for HLLV, 2 for HLLWW2) — whichever is smallest,
   with a floor of 1. Practice-time clusters are bin-packed (largest
   first, into whichever company currently has the fewest squads) so
   squads that train together stay together whenever the company count
   allows it, rather than one company per distinct time slot. Platoon
   count per company targets ~3 squads/platoon without dropping below the
   minimum. When squads or leadership fall short of a clean fit — too few
   squads for even one company, leadership capping company count below
   what squads could otherwise support, or fewer junior NCOs than squads
   needing a leader — a warning explains what's short rather than silently
   producing an invalid structure. **Apply suggested structure**
   materializes it into the committed roster — squads placed with
   practice times carried, every leadership billet deliberately left
   vacant for click-to-assign (§2.3) — saved but not baselined, so it
   shows up as reviewable pending changes. Intended order: Battalion
   CO/XO/SGM first, then companies (applied or hand-built), then
   leadership down through platoons/squads.

The older manual path (Import Company/Import Trooper into hand-created
rosters) still works and can be mixed in freely.

### 2.10 Org Chart View
On the Battalion Roster tab, **Generate Org Chart** swaps the text tree for a
hand-built box-and-connector chart (Battalion → Company → Platoon → Squad,
with each squad's member roster listed compactly inside its box) — no
charting library, consistent with the hand-built `Charts.tsx`. The button is
disabled whenever there are unsaved changes (same pending-change check as
Save/Revert), so the chart always reflects a saved/settled state rather than
a mid-edit one; clicking **Hide Org Chart** returns to the tree view. Scrolls
horizontally for battalions too wide to fit on screen. Squad member rosters
stay collapsed by default (just the leader shown) with a per-squad **Show N
members** toggle plus **Expand All**/**Collapse All** controls, to keep large
battalions readable.

### 2.11 Roster List / Print View
Also on the Battalion Roster tab, **Print Roster** swaps the tree for a flat,
indented list of the whole battalion — one line per billet (Battalion HQ →
Company → Platoon → Squad → members) reading `Position: Rank Name` — in
`RosterListView.tsx`. Unlike the Org Chart, it isn't gated on saved state; it
just reflects whatever's currently in the active roster. It's print-friendly:
opening the view adds a class to `<html>` that a `@media print` rule keys off
of to hide the nav/tabs/buttons, so printing (or Save as PDF) from the
browser produces a clean battalion roster page rather than the app chrome.
Clicking **Hide Roster List** returns to the tree view.

A toolbar (screen-only — hidden by the same print rule) narrows what the
list shows, and both the printout and the CSV export honor it:

- **Show** — whole battalion, a single company, or the Unassigned pool.
- **Who** — Everyone / Officers & NCOs only / Officers only / NCOs only,
  classified by the same rank tiers as the Split Planner (`leadership.ts`).
  In a scope-filtered view, empty slots are dropped rather than printed as
  VACANT (the occupant didn't match the filter — the billet isn't vacant),
  and squads/platoons/companies left with nobody matching are pruned
  entirely, so a filtered print reads as "these people, organized by unit"
  (`rosterExport.ts`).
- **Download CSV** — direct file download (no print dialog) of exactly
  what's on screen, one row per person: Company, Platoon, Squad, Billet,
  Rank, Name, Username, MOS. The filename encodes the active filters
  (e.g. `2-7-A-leadership-roster.csv`).

### 2.12 Search & Filter
A filter bar (`RosterFilterBar.tsx`) sits above both the Battalion Roster
and Drag & Drop tabs, sharing one filter state across them: a name search
box, a **Rank** dropdown and a **MOS** dropdown (both fixed lists — rank
from the same master rank list used everywhere else, MOS from the distinct
values actually present in the active roster — rather than free-text typing),
a **split tag** dropdown (Any / Neutral / HLLV / HLLWW2, for working through
the sort phase of §2.9), and a **Vacant leadership only** toggle. Matching troopers/vacant slots are
highlighted; companies, platoons, and squads with no match anywhere inside
them are hidden entirely rather than just collapsed, since every tree node
in this app is always expanded by default. Filtering is purely visual —
it never restricts what you can drag/drop or edit, and clearing it (via
**Clear filter**, shown only while a filter is active) instantly restores
the full tree.

---

## 3. Data Model (Actual)

```ts
interface Soldier {
  userId: string;        // 7Cav user id, or "local-<uuid>" for hand-created soldiers
  username: string;      // 7Cav username; blank for hand-created soldiers
  realName: string;
  rankId: string;
  rankShort: string;
  rankFull: string;
  positionTitle: string; // raw 7Cav position title, if imported
  mos: string;
  originLabel?: string;  // billet label at import time; unset if hand-created
  splitStatus?: "neutral" | "hllv" | "hllww2"; // battalion-split decision tag; unset = neutral
}

interface Squad {
  number: string;
  leader: Soldier | null;
  members: Soldier[];
  practiceTime?: string; // free-text drill schedule; planning metadata like splitStatus
}

interface Platoon {
  number: string;
  leader: Soldier | null;
  sergeant: Soldier | null;
  squads: Squad[];
}

interface Company {
  letter: string;   // short code, e.g. "A" or "UNASSIGNED" — not literally one letter
  name: string;
  commander: Soldier | null;
  executiveOfficer: Soldier | null;
  firstSergeant: Soldier | null;
  platoons: Platoon[];
}

interface Battalion {
  designation: string;
  commander: Soldier | null;
  executiveOfficer: Soldier | null;
  sergeantMajor: Soldier | null;
  companies: Company[];
}

interface RosterData {
  battalion: Battalion;
  unassigned: Company;   // the B/ACD-style holding pool; every roster has exactly one
  practiceTimesConfirmed?: boolean; // §2.9 phase 2 sign-off; gates Commit Split
  leadershipAccepted?: boolean;     // §2.9 phase 3 sign-off; gates Commit Split
  sendCharlieToHllv?: boolean;      // §2.9: carry C/2-7 + B/ACD into HLLV intact on commit
}
```

A roster's *identity* (name, id, Configuration tag) lives separately from its
data, in an index entry:
```ts
interface RosterSummary {
  id: string;
  name: string;
  updatedAt: string;
  configuration?: "old" | "new";
}
```

### 3.1 Storage
All client-side, in `localStorage`, namespaced per roster id:
- `roster-manager:index` — `RosterSummary[]`
- `roster-manager:active-id` — which roster is currently active
- `roster-manager:roster:<id>` / `roster-manager:baseline:<id>` / `roster-manager:changelog:<id>`
  — that roster's current data, last-saved baseline, and change log

No server-side database — see [§6.5](#65-deployment-status) for what a
multi-user/shared version would need instead.

---

## 4. UI/UX Layout (Actual)

Top of the page, three boxed groups side by side:

```
┌─────────────────┐  ┌───────────────────────────────┐  ┌───────────────────────────────────────┐
│ [Roster ▾] [+New]│  │ [Battalion Roster] [Drag&Drop]│  │ [Refresh][Save][Revert][Change Log(N)] │
│ [Rename][Delete] │  │ [Split Planner] [Analytics]   │  │                                         │
└─────────────────┘  └───────────────────────────────┘  └─────────────────────────────────────────┘
```

Below that, whichever tab is active (Battalion Roster and Drag & Drop also
get the shared filter bar, §2.12):
- **Battalion Roster** — optional Old/New badge, then the read-only tree +
  Unassigned pool.
- **Drag & Drop** — Battalion HQ, the Other/Building pane selectors, the
  Add Company / Add Trooper / Import Trooper / Import Company buttons, then
  the two Kanban panes side by side.
- **Split Planner** — the four guided split phases (§2.9): sort progress,
  leadership review, Commit Split, per-battalion build tracking.
- **Analytics** — the "Show as tables" toggle, then the four charts/reports.

The whole app uses a fixed dark theme (`#000` background) with a gold/blue
accent scheme matching the 7th Cavalry Regiment's own colors — chosen via
computed WCAG contrast checks, not eyeballed, since it's a fixed (non-adaptive)
color scheme with no light-mode variant.

---

## 5. User Workflows

### 5.1 Common Tasks

**Reorganize the real (live) roster:** Drag & Drop tab, move people around,
Save Changes to log it (or Revert to back out first).

**Add a trooper:** + Add Trooper → name/rank/MOS → lands in the Building pane
→ drag into place.

**Pull in real people:** + Import Trooper (one at a time, searchable) or
+ Import Company (a whole company, or B/ACD, at once) → both land in the
Building pane.

**Build a custom/alternate roster:** + New Roster (Blank) → + Add Company to
lay out structure → Import Trooper/Company to populate → drag into place.

**Split the battalion:** tag the live roster **Old**, create a **New**-tagged
roster per new battalion, Import Company to break down the old ones. The
Battalion Roster tab's badge tracks which one is in view.

**Review/undo history:** Change Log panel — Copy an entry, Delete a stray
one, or Clear All.

---

## 6. Technical Architecture (Actual)

### 6.1 Technology Stack
- **Frontend:** React 19 + TypeScript + Vite. No UI framework/component
  library — hand-written components and plain CSS throughout (`App.css`,
  per-component `.css` files).
- **Drag-and-drop:** `@dnd-kit/core`.
- **Charts:** hand-built (`Charts.tsx`), no charting library.
- **Org chart:** hand-built pure-CSS box/connector tree (`OrgChart.tsx`/`.css`),
  no diagramming library.
- **Backend:** FastAPI (Python), a thin proxy that holds the 7Cav MILPACS API
  bearer token server-side and re-exposes a few read-only endpoints
  (`/api/roster/{roster}`, `/api/awol`, `/api/ranks`) to the frontend. CORS
  locked to `http://localhost:5173`.
- **Storage:** browser `localStorage` only (see §3.1) — no database.

### 6.2 Data Flow
```
User action (drag, edit, import, add company...)
    ↓
Pure mutator in moveSoldier.ts (structuredClone + patch, returns a new RosterData)
    ↓
handleChange() in App.tsx: setRoster(next) + saveRoster(rosterId, next)
    ↓
Re-render
```
Save Changes / Revert Changes operate on a separate baseline snapshot
(`loadBaseline`/`saveBaseline`), independent of the live-editing roster state
— this is what makes the change log and revert-to-last-save behavior work.

### 6.3 Key Implementation Notes
- **Block-on-occupied drag:** dropping onto a filled billet is rejected
  outright (no swap/bump), decided explicitly over alternatives.
- **StrictMode-safe data loading:** the initial roster-fetch effect uses a
  cancellation flag to avoid a double-fetch race clobbering user actions
  taken between React 18/19 StrictMode's double effect invocation in dev.
- **Playwright E2E quirk:** the default 720px viewport height puts
  drag targets off-screen, causing false-negative drag failures unrelated to
  app behavior — tests use a tall (`2000px`) viewport instead.
- **dnd-kit ids must be unique per rendered instance, not per entity:**
  every `useDraggable`/`useDroppable` id is a React `useId()`, not the
  trooper's `userId` or a `JSON.stringify`'d destination. The real target
  travels via each hook's `data` field instead. This matters because the
  same person/billet can be on screen twice at once — both Drag & Drop
  panes pointed at the same company (§2.3, a documented supported case) or
  a freshly-committed split roster where both panes default to the same
  empty-battalion Unassigned pool (§2.9 phase 3) — and dnd-kit silently
  drops the drag (resolves `over` to nothing) when two elements share an id
  rather than erroring, so this class of bug produces no console error, just
  a drag that mysteriously does nothing.

### 6.4 External Data Source: 7Cav MILPACS API

The live-import features (§2.6) pull from the 7th Cavalry Regiment's public
roster API, `https://api.7cav.us` (spec: [github.com/7Cav/api](https://github.com/7Cav/api)).

**Auth**
- `Authorization: Bearer <API_KEY>` header, held server-side only (the
  FastAPI backend), never in frontend code or the repo.
- 401s come back as **plain text** (not JSON).

**Endpoints actually used**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/roster/ROSTER_TYPE_COMBAT/lite` | Lite profiles for the active combat roster — this app's live-import source |
| GET | `/api/v1/milpacs/ranks` | Canonical rank list (short/full name, display order) |

**Mapping to this app's data model** (`buildRoster.ts`)
- Position titles encode the hierarchy as `{Role} {Squad}/{Platoon}/{Company}/{Battalion}`
  (e.g. `Trooper 4/2/A/2-7`), parsed via regex into Battalion HQ / Company HQ /
  Platoon HQ / Squad roles.
- Company letters are mapped to local nicknames: `A→Able, B→Baker, C→Charlie,
  E→Easy` (hardcoded; see [§10](#10-open-questions--assumptions) on stability
  of this mapping).
- `B/ACD` positions (letter `B`, unit `ACD`) are routed to a separate
  `Unassigned` group instead of merged into Baker — they're a genuinely
  different population (BACD troopers awaiting assignment), not part of
  Baker Company.
- Ranks are sorted using the API's own `rankDisplayOrder` field, not a
  hardcoded rank list.

**Sync strategy**
- Read-only: nothing ever writes back to the 7Cav API.
- Troopers are matched/deduplicated by `userId`.

### 6.5 Deployment Status

Currently local-only (`localhost:5173` / `localhost:8000`), by design, while
still iterating pre-demo. Known gaps before any real deployment: hardcoded
localhost URLs/CORS, no TLS, no production process management, no
auth/access control, and the localStorage-only persistence model means each
browser has its own independent set of rosters — fine for a single-user tool,
a real design question if this needs to be shared across multiple leaders.

---

## 7. UI/UX Principles

- **Intuitive hierarchy:** indentation + expand/collapse mirrors chain of
  command.
- **Drag-and-drop first:** moving people is direct manipulation, not forms.
- **Explicit save, not silent autosave:** every edit persists to
  `localStorage` immediately (so nothing is lost on refresh), but the
  *change log* only records a batch when you click **Save Changes** — this
  is a deliberate two-tier model (auto-persist vs. explicit "log this batch"),
  not a "no save button needed" design.
- **Block, don't bump:** drag-and-drop onto an occupied billet is rejected,
  not swapped — explicit user choice over an alternative "bump" design.
- **Computed, not eyeballed, contrast:** the color scheme was chosen and
  verified via WCAG relative-luminance contrast ratios, not by eye.
- **Read-only vs. editable views kept separate:** Battalion Roster (tree,
  read-only) and Drag & Drop (Kanban, editable) are different tabs rather
  than one view with an edit-mode toggle.

---

## 8. Planned / Not Yet Built

### 8.1 Battalion Split (2-7 → Two Battalions)

2-7 Cavalry is expected to eventually split into **two** battalions, working
names **HLLV** and **HLLWW2**.

Originally sketched as a **Group layer** above Company in the data model (a
single roster holding multiple battalions/groups at once). Built instead on
top of Multiple Named Rosters (§2.1/§2.9) rather than restructuring
`RosterData` — no data-model change needed, since every roster already has
exactly one battalion, which is precisely what each split-off battalion is.
The supporting tooling (roster tagging/badge, whole-company import, the
per-trooper N/HLLV/HLLWW2 decision tag, and the guided five-phase **Split
Planner** with leadership review and Commit Split — see §2.9) is done; the
actual reorg work (deciding who goes where, then building each battalion's
structure) is ongoing, separate work using that tooling.

Built on a separate git branch (`battalion-split`), per the original decision
to keep `master` stable while this was worked out.

### 8.2 End-State Architecture Sketch

Once the battalion split reorg work (§8.1) settles, produce a single
architecture diagram summarizing the finished system. Deferred until then so
it reflects the real finished shape rather than a moving target. (The org
chart view, previously planned here, is done — see [§2.10](#210-org-chart-view).)

### 8.3 Other Not-Yet-Built Ideas

- **Unit Builder redesign — remaining ideas:** the first round is built
  (click-to-assign with tier-filtered candidate pickers §2.3, structure- and
  leadership-aware build suggestions §2.9 phase 5, the C→HLLV intact
  transfer). Still open if wanted: a dedicated step-by-step build surface
  that walks battalion HQ → company leadership → platoon leadership →
  squads as explicit stages rather than one open tree; generalizing the
  intact transfer to any company → either battalion; and smarter
  suggestion heuristics (MOS balancing *within* a company's platoons, e.g.
  spreading medics evenly, on top of the current practice-time clustering
  and leadership-capacity sizing).
- **Personnel query tab:** a separate tab for querying MILPACS profile data
  about troopers in 2-7 and B/ACD — graduations, disciplinary records,
  awards, secondary billets, ranks, and MOS. The full (non-lite) roster
  endpoint already returns all of this per profile (`records[]` with
  `recordType` GRADUATION/DISCIPLINARY/etc., `awards[]`, `secondaries[]`,
  `mos`, `rank`), so this is a frontend query/filter UI plus a printable
  list output (same print approach as §2.11).
- **Rank/MOS validation:** flag rank-inappropriate or MOS-mismatched billet
  assignments.
- **Notes/flags:** per-trooper notes (medical, discipline, promotion review).
- **Multi-user auth:** role-based access if this ever needs to be shared
  rather than run locally by one person (see §6.5).
- **Consistency question:** **+ Add Trooper** still always lands in
  Unassigned, while **+ Import Trooper** lands in the Building pane (per
  §2.3/§2.6) — worth revisiting whether Add Trooper should match Import
  Trooper's targeting for consistency.

---

## 9. Success Metrics

- **Ease of use:** New user can assign all troopers to positions in < 5 minutes
- **Speed:** Roster changes reflected in the UI and change log instantly
- **Accuracy:** No data loss or inconsistencies during drag-and-drop operations
- **Flexibility:** Supports custom unit structures and parallel what-if rosters

---

## 10. Open Questions / Assumptions

1. **Multi-user:** Will multiple leaders ever need to access/edit the same
   roster simultaneously? Today it's strictly single-user/single-browser
   (localStorage only) — see §6.5.
2. **Rank structure:** *(Resolved)* The MILPACS API supplies rank
   name/display-order per profile for combat-roster members; the app also
   keeps its own rank list (fetched from the API) for hand-created troopers.
3. **API key hosting:** *(Resolved)* A FastAPI backend proxy holds the key
   server-side; the frontend never sees it.
4. **Company-letter mapping stability:** Is the `A/B/C/E → Able/Baker/Charlie/Easy`
   mapping fixed, or could 2-7's lettering change (e.g. a Delta company added
   later)? Still hardcoded in `buildRoster.ts`; relevant to how the eventual
   battalion split (§8.1) names its own companies.
5. **Export formats:** If export/report (§8.3) gets built, priority on PDF,
   text, or spreadsheet?
6. **Mobile support:** Desktop-only today; not evaluated for tablet/phone use.

---

## 11. Getting Started for Development

See [`HOW_TO_USE.md`](HOW_TO_USE.md) for exact setup commands (backend venv +
FastAPI, frontend `npm install`/`npm run dev`) and a full feature walkthrough.

Repo layout:
- `backend/app/main.py` — the FastAPI proxy (three read-only endpoints).
- `frontend/src/lib/` — pure data logic: `buildRoster.ts` (live-API →
  `RosterData`), `moveSoldier.ts` (all mutations, including the split-status
  patch), `splitReorg.ts` (Commit Split pool-roster generation),
  `leadership.ts` (rank → leadership-tier classification), `filterRoster.ts`
  (search/filter matching), `persistence.ts` (localStorage), `changelog.ts`,
  `analytics.ts`.
- `frontend/src/components/` — UI: `RosterTree`/`DragDropTree`/`OrgChart`/
  `RosterListView` (the four roster views), `SplitPlanner`, `RosterFilterBar`,
  `SplitStatusToggle`, `RosterPicker`, `SoldierForm`,
  `ImportSoldierPicker`/`ImportCompanyPicker`, `AnalyticsTab`, `ChangeLogPanel`.

---

## Appendix A: Example Battalion Structure (2-7 Cavalry)

```
2-7 CAVALRY BATTALION (CO: Colonel Cam)
├── Battalion HQ
│   ├── Commanding Officer (Colonel Cam)
│   ├── Executive Officer (Lieutenant Colonel Mix)
│   └── Sergeant Major
├── Able Company (CO: Captain)
│   ├── 1st Platoon "Iron Crucible" (PSG: SPC Torres)
│   │   ├── 1st Squad (SL: CPL Anderson)
│   │   ├── 2nd Squad (SL: CPL Brown)
│   │   └── 3rd Squad (SL: CPL Davis)
│   ├── 2nd Platoon (PSG: SPC Johnson)
│   │   └── [3 squads]
│   └── 3rd Platoon (PSG: VACANT)
├── Baker Company (CO: VACANT)
│   ├── 1st Platoon
│   │   └── [3 squads]
│   └── [2 more platoons]
├── Charlie Company (CO: CPT Martinez)
│   └── [3 platoons with squads]
└── Easy Company (CO: VACANT)
    └── [3 platoons with squads]
```

---

## Appendix B: Sample Trooper Data (matches the actual `Soldier` shape)

```ts
[
  { userId: "1001", username: "Torres.S", realName: "Torres", rankId: "r4", rankShort: "SPC", rankFull: "Specialist", positionTitle: "Squad Leader 1/1/A/2-7", mos: "11B" },
  { userId: "1002", username: "Anderson.C", realName: "Anderson", rankId: "r3", rankShort: "CPL", rankFull: "Corporal", positionTitle: "Trooper 1/1/A/2-7", mos: "11B" },
  { userId: "local-9f2c...", username: "", realName: "Chen", rankId: "r1", rankShort: "PVT", rankFull: "Private", positionTitle: "", mos: "11B" }
]
```
The third entry is a hand-created trooper (`local-` prefixed id, blank
`username`/`positionTitle`) rather than one imported from the live API.
