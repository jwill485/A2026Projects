# Class Grads — How to Use

A read-only viewer for 7th Cavalry Regiment class graduations — pulled live
from the roster, covering every active-duty member of the regiment: 1-7,
2-7, 3-7, ACD, and Regimental/section staff (S1/S2/S6/MP/WAG/RRD/RDC,
DEVCOM). Searchable by name, rank, MOS, position, or class, with dedicated
filters for battalion, company, rank tier, graduated class, and WW2 Ranger
Selection Requirement status.

## Running it locally

Every time you want to use the app, you need **two terminal windows open at
the same time** — one for the backend, one for the frontend. Leave both
running while you use the app; closing either one stops that half. (One-time
setup — venv, `pip install`, `npm install`, the `.env` file — is already done
on this machine, so day-to-day you just need the four commands below.)

**Terminal 1 — backend**

Open a terminal (PowerShell is fine) and run:
```
cd "C:\Users\cskat\OneDrive\Desktop\7Cav\a2026Projects\class_grads\backend"
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```
(Calling `python.exe` directly instead of `.venv\Scripts\activate` sidesteps
a common PowerShell error — "running scripts is disabled on this system" —
that shows up on machines where script execution policy is locked down by
default. Same effect, no activation step needed.)

**Terminal 2 — frontend**

Open a **second** terminal (don't reuse the first one) and run:
```
cd "C:\Users\cskat\OneDrive\Desktop\7Cav\a2026Projects\class_grads\frontend"
npm run dev
```

Then open the URL Terminal 2 prints (`http://localhost:5173`) in your
browser.

**When you're done for the session**, just close both terminal windows (or
press `Ctrl+C` in each, then close them) — that's the same as the servers
being "shut down."

If something won't load: check both windows are still open and didn't print
an error, and that the browser URL matches what Terminal 2 printed. The
frontend expects the backend at `http://localhost:8000`, and every page load
re-fetches live from the 7Cav API, so it can take a few seconds to populate.

## Using the app

- **The table** — one row per active-duty member across 1-7, 2-7, 3-7, ACD,
  and Regimental/section staff: Name, Rank, Battalion, Company, Position,
  MOS, a graduation count, and a
  WW2 Ranger Selection Requirement progress badge (`X/14`). Click any column
  header to sort by it — click again to reverse the direction.
- **Click any row** to expand it and see two things side by side: that
  person's full graduation history (date + class/course description exactly
  as recorded in their milpacs file), and their WW2 Ranger Selection
  Requirement status — either "Qualified" or a list of exactly which
  required classes they're still missing. Click the row again to collapse
  it.
- **Search bar** — filters the table as you type, matching against name,
  username, rank, MOS, battalion, position, and the text of any of that
  person's graduations (so you can search a class name like "Sniper" to find
  everyone who's completed it). Clear the box to see everyone again.
- **Filter dropdowns** — Battalion, Company, Rank tier, Graduated class, and
  Ranger Selection (All / Qualified / Close — missing 3 or fewer) all
  combine with each other and with the search bar. **Clear filters** appears
  whenever any are active.
- **Data is always live** — every page load re-pulls the current roster and
  graduation records from the 7Cav API, so there's nothing to refresh or
  re-import.

## Pulling a CSV/JSON snapshot instead

If you just want a file to share or open in a spreadsheet rather than the
live web view, use the standalone pull script from the repo root (needs its
own one-time `npm install` there, separate from `frontend/`):
```
cd "C:\Users\cskat\OneDrive\Desktop\7Cav\a2026Projects\class_grads"
npm run pull
```
This writes `output/graduations.json` and `output/graduations.csv` — the
same data as the web view, as a point-in-time snapshot. Re-run it any time
to refresh those files.

## What counts as "in scope"

A member shows up in either the app or the pull script if their **current
primary position** is anywhere in 1-7, 2-7, 3-7 (Battalion HQ, or any
company/platoon/squad), the ACD holding pool (its own A/B/C/D companies), or
any other active-duty billet: Regimental Staff (CO/XO/CSM and staff aides),
S1/S2/S6, MP, WAG, RRD, RDC, or DEVCOM. Those show up under a **"Regiment"**
battalion, with each section as its own "company." Unassigned "New Recruit"
accounts, obvious test accounts, and Reserve-status billets are excluded —
none of them count as active duty for this tool's purposes.

## WW2 Ranger Selection Requirement

A trooper qualifies once they've graduated all 14 of a specific set of Hell
Let Loose classes. The matching logic (`backend/app/ranger.py`) tolerates
some wording variants found in the live data (typos, hyphenation, old
naming — e.g. "Anti-Tank Course" and "Anti Tank Course" both count), but
always requires "Hell Let Loose" to appear in the record text, so a
similarly-named class from a different game never counts. If any of those
variant mappings look wrong, they're a short, easily-edited list at the top
of that file.

## What "graduations" means

The 7Cav API doesn't have a dedicated "class" concept — graduations are one
of several record types in a person's history (alongside promotions,
transfers, disciplinary actions, etc.). This tool pulls only the
`RECORD_TYPE_GRADUATION` entries, which covers things like Boot Camp, NCOA
courses, and other Hell Let Loose training courses. The class name/date come
straight from milpacs' free-text record description — there's no structured
class ID to group by yet.
