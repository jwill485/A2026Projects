# RosterManager — How to Use

A visual tool for managing the 2-7 Cavalry Battalion's org structure: view the
live roster, drag-and-drop soldiers between billets, track changes, and build
out custom/alternate rosters from scratch.

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

## The three tabs

At the top of the page are two boxes: the **tabs** (what you're viewing) and
the **action buttons** (things you can do). The tabs are:

- **Battalion Roster** — a read-only tree view of the current roster:
  Battalion HQ → Companies → Platoons → Squads → soldiers, plus a separate
  Unassigned pool below it.
- **Drag & Drop** — the same structure, but editable: drag soldiers between
  billets, add companies/platoons/squads, and add/edit/delete/import
  soldiers.
- **Analytics** — charts and tables: leadership fill rate, headcount, MOS
  breakdown, and a vacancy report.

## Action buttons (top bar)

- **Refresh from API** — discards any manual changes and rebuilds the roster
  from live 7Cav data. Asks for confirmation first.
- **Start Blank Roster** — wipes everything and starts an empty roster (no
  companies, no soldiers) so you can build a custom structure from scratch.
  Asks for confirmation first.
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
panes ("Kanban" style). Use the **Left pane** / **Right pane** dropdowns to
pick which company (or the Unassigned pool) each side shows — pick the same
company on both sides if you just want one big pane.

- **Dragging a soldier**: click and hold their name, drag to any billet
  (Commander, XO, 1SG, Platoon Leader/Sergeant, Squad Leader, or a squad's
  member list) in either pane, and release. Occupied billets are
  **blocked** — you can't drop onto a slot that already has someone in it;
  move or remove the current occupant first.
- **✎ (edit)** next to a soldier's name — opens a form to change their name,
  rank, or MOS without moving them.
  **✕ (delete)** — removes them from the roster entirely (with confirmation).
  These are separate from the name itself so clicking them doesn't start a
  drag.
- **+ Add Platoon** / **+ Add Squad** — adds an empty platoon to a company, or
  an empty squad to a platoon. There's no remove for these — an unused empty
  one is harmless, just leave it.
- **+ Add Company** — type a short code (e.g. `D`) and a name (e.g. `Dog`),
  then click Add Company. Codes must be unique.
- **+ Add Soldier** — opens a form (name, rank, MOS) and drops the new
  soldier into the Unassigned pool, ready to drag into place.
- **+ Import from 2-7** — opens a searchable list of every real soldier
  currently in the live 2-7 + B/ACD roster (name, rank, current real-world
  unit). Click **Add** next to anyone to copy them into your roster's
  Unassigned pool with their real name/rank/MOS — useful for seeding a custom
  roster without typing everyone in by hand. Already-imported soldiers show
  **Added** and can't be added twice.

## Unassigned pool

Soldiers from B/ACD (or anyone not yet placed in a company) live in a
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

## Typical workflows

**Reorganizing the real roster:** go to Drag & Drop, move people around,
click Save Changes when you're happy (this logs what changed), or Revert
Changes to back out before saving.

**Building a custom/alternate roster:** click Start Blank Roster, then use
+ Add Company to lay out your structure, + Import from 2-7 to pull in real
people (or + Add Soldier for hypothetical ones), and drag them into place.

**Cleaning up the history:** if a test move or mis-click got saved to the
Change Log, open the Change Log panel and Delete that specific entry, or
Clear All to start the log over.
