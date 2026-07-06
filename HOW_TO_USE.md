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
  [Tagging Old vs. New](#tagging-old-vs-new-battalion-split) below.
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

## The three tabs

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
  All** above the chart.
- **Drag & Drop** — the same structure, but editable: drag troopers between
  billets, add companies/platoons/squads, and add/edit/delete/import
  troopers and whole companies.
- **Analytics** — charts and tables: leadership fill rate, headcount, MOS
  breakdown, and a vacancy report.

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
  an empty squad to a platoon. There's no remove for these — an unused empty
  one is harmless, just leave it.
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

## Tagging Old vs. New (battalion split)

2-7 is expected to eventually split into two battalions. Rather than one
roster trying to represent both at once, build each one as its own separate
named roster:

1. Tag your current live roster **Old** via **Rename** (Edit Roster →
   Configuration → Old).
2. Create a **+ New Roster** per new battalion, tagged **New**.
3. In each new roster, use **+ Import Company** to pull in whichever old
   companies (or B/ACD) are being folded into it, then drag troopers between
   panes to actually divide them up — the **Change Log** will show exactly
   where each person came from.

The Battalion Roster tab's badge always tells you which one you're looking
at, so it's hard to mix them up mid-reorg.

## Typical workflows

**Reorganizing the real (live) roster:** go to Drag & Drop, move people
around, click Save Changes when you're happy (this logs what changed), or
Revert Changes to back out before saving.

**Building a custom/alternate roster:** click + New Roster (Blank), then use
+ Add Company to lay out your structure, + Import Trooper or + Import Company
to pull in real people, and drag them into place.

**Splitting the battalion into two:** see [Tagging Old vs. New](#tagging-old-vs-new-battalion-split)
above.

**Cleaning up the history:** if a test move or mis-click got saved to the
Change Log, open the Change Log panel and Delete that specific entry, or
Clear All to start the log over.
