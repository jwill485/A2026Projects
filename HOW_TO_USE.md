# RosterManager — How to Use

A visual tool for managing the 2-7 Cavalry Battalion's org structure: view the
live roster, drag-and-drop troopers between billets, track changes, and build
out custom/alternate rosters — including breaking the battalion down into a
new configuration — without touching the real 2-7 data.

## Running it locally

You need two things running at once: the backend (proxies the 7Cav API and
keeps the API key server-side) and the frontend (the UI).

**Backend**
```
cd backend
python -m venv .venv          # first time only
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Make sure a `.env` file exists at the repo root with:
```
MILPACS_API_KEY=your_key_here
```

**Frontend**
```
cd frontend
npm install                   # first time only
npm run dev
```
Then open the URL Vite prints (usually `http://localhost:5173`).

The frontend expects the backend at `http://localhost:8000` and the backend
only accepts requests from `http://localhost:5173` — if you change either
port, update `frontend/src/lib/api.ts` and `backend/app/main.py` to match.

## Rosters (top-left box)

The app can hold several independent, named rosters at once — not just the
live 2-7 data. A dropdown plus three buttons let you manage them:

- **The dropdown** — switches which roster is active everywhere in the app
  (all three tabs). Switching is instant and safe: every roster keeps its own
  moves, baseline, and change log independently, so nothing is lost by
  switching away and back.
- **+ New Roster** — asks for a name, whether to start **Blank** (empty, no
  companies) or **Duplicate current roster** (copies everything in the
  roster you're currently viewing), and an optional **Configuration** tag:
  **None**, **Old (pre-split)**, or **New (post-split)** — see
  [Splitting the battalion](#splitting-the-battalion-split-planner) below.
- **Rename** — opens "Edit Roster", where you can change the name and/or the
  Configuration tag of the currently active roster at any time.
- **Delete** — removes the active roster entirely (with confirmation).
  Disabled whenever it's the only roster left — there must always be at
  least one.

The very first time you run the app, it automatically creates one roster
named "2-7 Cavalry Battalion" from the live API data (or, if you'd already
been using an older version of the app before rosters had names, your
existing saved data is carried into a roster with that same name — nothing
is lost).

## The four tabs

Next to the roster dropdown are two more boxes: the **tabs** (what you're
viewing) and the **action buttons** (things you can do). The tabs are:

- **Battalion Roster** — a read-only tree view of the current roster:
  Battalion HQ → Companies → Platoons → Squads → troopers, plus a separate
  Unassigned pool below it. If the active roster has a Configuration tag set,
  a colored badge appears here reading "Viewing: Old Configuration" or
  "Viewing: New Configuration" so it's always clear which one you're looking
  at. A **Generate Org Chart** button swaps the tree for a box-and-connector
  chart instead — it's disabled whenever you have unsaved changes (same rule
  as Save Changes), so it only ever shows a saved/settled roster; click
  **Hide Org Chart** to go back to the tree. Squad member lists stay
  collapsed by default to keep the chart compact — click **Show N members**
  on a squad to expand just that one, or use **Expand All** / **Collapse
  All** above the chart. A **Print Roster** button swaps the tree for a flat,
  indented list of the whole battalion (one line per billet) — unlike the
  org chart, it works even with unsaved changes. Use your browser's Print
  (or Save as PDF) while it's open for a clean printout without the app's
  nav/buttons; click **Hide Roster List** to go back to the tree.
- **Drag & Drop** — the same structure, but editable: drag troopers between
  billets, add companies/platoons/squads, and add/edit/delete/import
  troopers and whole companies.
- **Split Planner** — the guided home for splitting 2-7 into two new
  battalions, in four tracked phases — see
  [Splitting the battalion](#splitting-the-battalion-split-planner) below.
- **Analytics** — charts and tables: leadership fill rate, headcount, MOS
  breakdown, and a vacancy report.

## Search & filter

A filter bar sits above both the Battalion Roster and Drag & Drop tabs (one
shared filter — it stays active if you switch between them): a name search
box, **Rank** and **MOS** dropdowns (fixed lists, not free typing), a
**split tag** dropdown (Any / Neutral / HLLV / HLLWW2 — handy for finding
who's still undecided during a split), and a **Vacant leadership only**
checkbox. Matches get a yellow highlight;
companies/platoons/squads with no match anywhere inside them disappear from
view entirely. It's purely visual — dragging, editing, and every other
action still works normally underneath — and **Clear filter** (shown only
while a filter is active) instantly brings everything back.

## Action buttons (top bar)

- **Refresh from API** — discards any manual changes to the *active* roster
  and rebuilds it from live 7Cav data. Asks for confirmation first.
- **Save Changes (N)** — only enabled when you have unsaved moves/edits. Diffs
  the current roster against the last saved snapshot and writes a dated entry
  to the Change Log describing what moved. This becomes the new baseline.
- **Revert Changes** — discards everything since the last Save (or since the
  roster was loaded, if you haven't saved yet) and restores that baseline.
  Asks for confirmation first.
- **Change Log (N)** — toggles a panel showing every saved batch of changes,
  each as a timestamped list of "who moved from → to". Each entry has a
  **Copy** button (copies that entry as text) and a **Delete** button (removes
  just that entry). There's also a **Clear All** button to wipe the whole log.
  Use Delete/Clear All to drop unintentional or test moves you don't want kept
  in the history — this doesn't undo the roster itself, only the log.

## Using Drag & Drop

The Drag & Drop tab shows Battalion HQ at the top, then two side-by-side
panes ("Kanban" style). Use the two dropdowns to pick which company (or the
Unassigned pool) each side shows:

- **Other (left)** — whatever you want a second view of: an old company
  you're breaking down, a comparison, or just anywhere else.
- **Building (right — new troopers land here)** — this is the destination.
  Anyone brought in via **+ Add Trooper** or **+ Import Trooper** lands here,
  so point it at whichever company you're currently populating.

You can point both dropdowns at the same company if you just want one big
pane instead of two.

- **Dragging a trooper**: click and hold their name, drag to any billet
  (Commander, XO, 1SG, Platoon Leader/Sergeant, Squad Leader, or a squad's
  member list) in either pane, and release. Occupied billets are
  **blocked** — you can't drop onto a slot that already has someone in it;
  move or remove the current occupant first.
- **✎ (edit)** next to a trooper's name — opens a form to change their name,
  rank, or MOS without moving them.
  **✕ (delete)** — removes them from the roster entirely (with confirmation).
  These are separate from the name itself so clicking them doesn't start a
  drag.
- **+ Add Platoon** / **+ Add Squad** — adds an empty platoon to a company, or
  an empty squad to a platoon. Each platoon/squad also has a small ✕ next to
  its name to remove it — but only while it's empty (no leader/sergeant, and
  for a platoon, none of its squads have anyone in them either); otherwise
  the ✕ is disabled with a tooltip explaining why. Move everyone out first if
  you want to remove a populated one.
- **+ Add Company** — type a short code (e.g. `D`) and a name (e.g. `Dog`),
  then click Add Company. Codes must be unique within the roster.
- **+ Add Trooper** — opens a form (name, rank, MOS) and drops the new
  trooper into whichever company the **Building** pane is currently pointed
  at, ready to drag into place.
- **+ Import Trooper** — opens a searchable list of every real trooper
  currently in the live 2-7 + B/ACD roster (name, rank, current real-world
  unit). Click **Add** next to anyone to copy them into the **Building** pane
  with their real name/rank/MOS — useful for seeding a custom roster without
  typing everyone in by hand. Already-imported troopers show **Added** and
  can't be added twice.
- **+ Import Company** — brings in an *entire* real company at once —
  Able, Baker, Charlie, Easy, or **Unassigned (B/ACD)** — with its full
  platoon/squad structure and leadership intact, instead of adding people one
  at a time. Importing Unassigned (B/ACD) merges its real structure into your
  roster's own Unassigned pool (every roster already has one, so it doesn't
  show up as a separate pane). If a trooper from that company already exists
  elsewhere in your roster (e.g. you'd already imported them individually),
  they're quietly skipped rather than duplicated. Already-imported companies
  show **Imported** and can't be re-added.

Anyone brought in via either import button remembers where they came from —
see the Change Log entry below.

## Unassigned pool

Troopers from B/ACD (or anyone not yet placed in a company) live in a
separate **Unassigned** group, organized the same way as a company
(platoons/squads) rather than as a flat list. Select it from either pane
dropdown in Drag & Drop to move people out of it.

## Analytics tab

Toggle **Show as tables** to switch any chart to a plain data table (useful
for copying numbers out). Includes:
- Leadership fill rate by company (filled vs. vacant leadership billets)
- Headcount by company
- MOS breakdown across the whole roster
- Vacancy report — a plain list of every currently-vacant leadership billet

## Splitting the battalion (Split Planner)

2-7 is expected to eventually split into two battalions (working names
**HLLV** and **HLLWW2**). The **Split Planner** tab walks you through it in
four phases, each with its own progress tracking. Nothing is locked — every
other tool keeps working the whole time — but the intended order is:

**1. Sort troopers.** The app opens on the Split Planner, and phase 1 has a
**Start sorting (N to go) →** button that drops you straight into the
Battalion Roster tree with the filter pre-set to undecided troopers — as you
tag people they disappear from the view, so it works like a queue. Use the
small **N / HLLV / HLLWW2** toggle next to each trooper's name (also
available on Drag & Drop) to mark them Neutral (undecided) or assigned to
one of the two new battalions. Tagging doesn't touch Save/Revert or the
Change Log — it's a lightweight decision layer you can leave half-finished
and come back to. The planner shows a running count of undecided vs. tagged.

**2. Review leadership.** The planner breaks each battalion's tagged group
into **Officers / Senior NCOs / Junior NCOs / Troopers** (click a tier to
see names). Each tier is labeled with the billets it can fill — officers
for CO/XO/Platoon Leader, senior NCOs for SGM/1SG/Platoon Sergeant, junior
NCOs for Squad Leader. If a battalion shows a red **0** in a leadership
tier, it can't fill those billets yet — re-balance your tags before moving
on.

**3. Commit the split.** Click **Commit Split** to generate the `HLLV` and
`HLLWW2` rosters. Each starts as an *empty battalion* — no companies, HQ
vacant — with everyone tagged for it waiting in its Unassigned pool, sorted
by rank. Deliberately no old structure carried over: you build the new
battalion around the leadership you actually have, rather than reshaping
2-7's layout. Safe to re-run as tags change — it updates the same two
rosters rather than duplicating them.

**4. Build the battalions.** The planner tracks each battalion's progress
(HQ filled, companies created, company leadership filled, troopers still in
the pool) and gives you an **Open in Drag & Drop** button per battalion.
Build order: drag your Battalion CO/XO/SGM out of the pool onto Battalion
HQ first, then **+ Add Company** for each company you have leadership for,
fill its CO/XO/1SG, and work down through platoons and squads.

The split toggles only appear on the source roster — rosters tagged **New**
(the split's outputs) hide them, and the Battalion Roster tab's badge always
tells you which one you're looking at. The older manual path (creating
rosters yourself and using **+ Import Company** / **+ Import Trooper**)
still works too and can be mixed in freely.

## Typical workflows

**Reorganizing the real (live) roster:** go to Drag & Drop, move people
around, click Save Changes when you're happy (this logs what changed), or
Revert Changes to back out before saving.

**Building a custom/alternate roster:** click + New Roster (Blank), then use
+ Add Company to lay out your structure, + Import Trooper or + Import Company
to pull in real people, and drag them into place.

**Splitting the battalion into two:** open the **Split Planner** tab and
follow its four phases — tag everyone N/HLLV/HLLWW2, review each group's
leadership, Commit Split, then build each battalion up from its pool. See
[Splitting the battalion](#splitting-the-battalion-split-planner) above.

**Cleaning up the history:** if a test move or mis-click got saved to the
Change Log, open the Change Log panel and Delete that specific entry, or
Clear All to start the log over.
