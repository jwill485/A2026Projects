# RosterManager — How to Use

A visual tool for managing the 2-7 Cavalry Battalion's org structure: view the
live roster, drag-and-drop troopers between billets, track changes, and build
out custom/alternate rosters — including breaking the battalion down into a
new configuration — without touching the real 2-7 data.

## Running it locally

Every time you want to use the app, you need **two terminal windows open at
the same time** — one for the backend, one for the frontend. Leave both
running while you use the app; closing either one stops that half. (One-time
setup — venv, `pip install`, `npm install`, the `.env` file — is already done
on this machine, so day-to-day you just need the four commands below.)

**Terminal 1 — backend**

Open a terminal (PowerShell is fine) and run:
```
cd "C:\Users\cskat\OneDrive\Desktop\7Cav\RosterManager\backend"
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```


**Terminal 2 — frontend**

Open a **second** terminal (don't reuse the first one) and run:
```
cd "C:\Users\cskat\OneDrive\Desktop\7Cav\RosterManager\frontend"
npm run dev
```


**When you're done for the session**, just close both terminal windows (or
press `Ctrl+C` in each, then close them) — that's the same as the servers
being "shut down."

If something won't load: check both windows are still open and didn't print
an error, and that the browser URL matches what Terminal 2 printed. The
frontend expects the backend at `http://localhost:8000` and the backend only
accepts requests from `http://localhost:5173` — if you ever change either
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
  org chart, it works even with unsaved changes. A toolbar above the list
  narrows it down: **Show** picks the whole battalion, a single company, or
  the Unassigned pool, and **Who** picks Everyone / Officers & NCOs only /
  Officers only / NCOs only (filtered views drop empty slots and units with
  nobody matching, so you get a clean leadership list rather than a page of
  VACANTs). Use your browser's Print (or Save as PDF) while it's open for a
  clean printout without the app's nav/buttons or the toolbar — the printout
  matches whatever filters you've picked. **Download CSV** saves the same
  filtered list straight to a spreadsheet-ready file (Company, Platoon,
  Squad, Billet, Rank, Name, Username, MOS) with no print dialog involved.
  Click **Hide Roster List** to go back to the tree.
- **Drag & Drop** — the same structure, but editable: drag troopers between
  billets, add companies/platoons/squads, and add/edit/delete/import
  troopers and whole companies. Laid out as three columns — **Pool** (every
  unplaced trooper), **Structure** (the one company you're currently
  building), **Detail** (click any unit's ⓘ to see its full breakdown) —
  see [Using Drag & Drop](#using-drag--drop) below.
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

The Drag & Drop tab shows Battalion HQ at the top, then a three-column
workbench:

- **Pool (left)** — every trooper not yet placed in a company, always
  visible (no dropdown needed to see it). Filter by **tier** (Officers /
  Senior NCOs / Junior NCOs / Troopers), **MOS**, **practice time** (if
  they came from a squad that had one set), or search by name. Drag anyone
  out of here into the Structure column, or drag someone back in to
  unassign them.
- **Structure (center)** — one company at a time, picked from the
  **Building** dropdown. Every company/platoon/squad header shows a row of
  small dots — **●** filled, **○** vacant — for that unit's leadership
  billets, visible without expanding anything. Squad headers also show a
  compact MOS tally.
- **Detail (right)** — click the **ⓘ** next to any battalion, company,
  platoon, or squad to load its full breakdown here: who fills each
  billet, headcount, and MOS makeup.

- **Click to assign (the easy way)**: every **VACANT** billet — including
  the leadership-strip dots themselves — is clickable, and each squad's
  member list ends with **+ assign trooper**. Clicking opens a picker
  showing just the people that billet normally draws from (officers for
  CO/XO/Platoon Leader, senior NCOs for SGM/1SG/PSG, junior NCOs for Squad
  Leader, everyone for members), sorted by rank with pool members first,
  each showing their MOS, where they currently sit, and their squad's
  practice time. Search to narrow, tick **Show all ranks** if you need
  someone outside the usual tier, and click **Assign** — done. Since only
  one company is on screen at a time, this is also how you move someone
  from a *different* company: pick them from wherever they currently sit.
- **Dragging a trooper**: still works everywhere — click and hold their
  name, drag to any billet (Commander, XO, 1SG, Platoon Leader/Sergeant,
  Squad Leader, or a squad's member list), and release. Occupied billets
  are **blocked** — you can't drop onto a slot that already has someone in
  it; move or remove the current occupant first.
- **Dragging a whole squad**: click and hold the **⠿ Squad N** handle in a
  squad's summary line (next to its Leader) and drop it on the dashed
  **"Drop a squad here"** strip below any platoon's squad list in the
  *same* company — moves the leader and every member together in one
  action. If that platoon already has a squad with the same number, the
  incoming one is automatically renumbered rather than colliding. (Moving
  a whole squad to a *different* company isn't supported yet — only
  individual troopers can move cross-company right now, via click to
  assign.)
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
  then click Add Company. Codes must be unique within the roster; the new
  company becomes the active one in Structure.
- **+ Add Trooper** — opens a form (name, rank, MOS) and drops the new
  trooper into the Pool, ready to assign or drag into place.
- **+ Import Trooper** — opens a searchable list of every real trooper
  currently in the live 2-7 + B/ACD roster (name, rank, current real-world
  unit). Click **Add** next to anyone to copy them into the Pool with their
  real name/rank/MOS — useful for seeding a custom roster without typing
  everyone in by hand. Already-imported troopers show **Added** and can't
  be added twice.
- **+ Import Company** — brings in an *entire* real company at once —
  Able, Baker, Charlie, Easy, or **Unassigned** — with its full
  platoon/squad structure and leadership intact, instead of adding people
  one at a time, and switches Structure to show it. Importing Unassigned
  merges its real structure into your roster's own Pool. If a trooper from
  that company already exists elsewhere in your roster (e.g. you'd already
  imported them individually), they're quietly skipped rather than
  duplicated. Already-imported companies show **Imported** and can't be
  re-added.

Anyone brought in via either import button remembers where they came from —
see the Change Log entry below.

If you're viewing a freshly-committed HLLV or HLLWW2 roster, the toolbar
also offers **💡 Suggest structure** — the same suggested-companies preview
as the Split Planner's Unit Builder phase (see below), computed from the
source roster's tags and practice times, applied directly to the roster
you're already looking at.

## Unassigned pool

Troopers from B/ACD (or anyone not yet placed in a company) live in a
separate **Unassigned** group. On the Battalion Roster tab it's shown
organized like a company (platoons/squads); on Drag & Drop, it's the
always-visible **Pool** column described above.

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
five phases, each with its own progress tracking. Nothing is locked — every
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

If the sorting decision was made offline (say, in a spreadsheet), skip the
clicking: **Import tags from CSV…** on the same phase card applies tags in
bulk from a file. Two columns per line — the trooper, then `N`, `HLLV`, or
`HLLWW2` (comma, semicolon, or tab separated; a header line is fine):

```
Trooper,Tag
Cameron.J,HLLV
Doe.J,HLLWW2
Smith.A,N
```

Usernames (like `Cameron.J`) are the safest way to name people, but real
names work too — if a real name matches more than one trooper it's skipped
and reported so you can switch that line to the username. After the import,
a summary lists how many tags applied plus anyone not found and any lines
it couldn't read. Re-importing a corrected file is always safe — later tags
just overwrite earlier ones.

If Charlie Company is going to HLLV wholesale, skip sorting it person by
person: tick **Send Charlie Company (C/2-7) to HLLV intact** on the same
card. B/ACD is currently where Charlie's real people live (the live Charlie
shell itself is empty), so checking this box tags **both** C's members and
everyone in the B/ACD pool HLLV immediately. When you commit, B/ACD's
platoons get folded in under Charlie's own and the whole thing — structure,
leadership, and practice times — lands in HLLV as one unit, instead of
either group going through the pool.

**2. Practice times.** One question: accept the current practice times, or
edit them first? **Accept current practice times** fills in the known 2-7
schedule for every squad (Able at THU 2359z, Baker by platoon, Easy and
the B/ACD pool per squad) and signs the phase off in one click. **Edit
practice times** expands a per-squad table — every current squad including
the B/ACD pool's, grouped by company, each row showing the squad's MOS
makeup (like `11B ×6 · 68W ×2`) beside a time box pre-filled with those
same defaults — tweak whatever differs, then **Save practice times** to
sign off and collapse the table. Edits save as you type, don't count as
pending changes, and travel with a squad if you drag the whole squad
somewhere else. Changing a time later clears the sign-off until you save
again.

**3. Review leadership.** The planner breaks each battalion's tagged group
into **Officers / Senior NCOs / Junior NCOs / Troopers** (click a tier to
see names). Each tier is labeled with the billets it can fill — officers
for CO/XO/Platoon Leader, senior NCOs for SGM/1SG/Platoon Sergeant, junior
NCOs for Squad Leader. If a battalion shows a red **0** in a leadership
tier, it can't fill those billets yet — re-balance your tags before moving
on. When both battalions look workable, click **Accept leadership
review** to sign the phase off. Re-tagging anyone afterwards (toggle, CSV
import, or random tags) clears the acceptance, since the review no longer
matches the tags.

**4. Commit the split.** **Commit Split** stays locked until three things
are true — everyone is sorted (0 undecided), practice times are accepted,
and the leadership review is accepted — and lists whichever are still
missing right under the button. Once unlocked, clicking it generates the
`HLLV` and `HLLWW2` rosters. Each starts as an *empty battalion* — no companies, HQ
vacant — with everyone tagged for it waiting in its Unassigned pool, sorted
by rank. Deliberately no old structure carried over: you build the new
battalion around the leadership you actually have, rather than reshaping
2-7's layout. Safe to re-run as tags change — it updates the same two
rosters rather than duplicating them.

**5. Unit Builder.** The planner tracks each battalion's progress
(HQ filled, companies created, company leadership filled, troopers still in
the pool) and gives you an **Open in Drag & Drop** button per battalion.
Each battalion also gets a **💡 Suggested structure**: your old squads kept
intact, grouped into proposed companies by practice time, with each squad's
origin and MOS makeup listed. The size follows each battalion's standards —
**HLLV** (the priority battalion) can go up to **4 companies**, **HLLWW2**
is capped at **1–2**; both want at least **2 platoons per company** and
**2 squads per platoon**. How many companies actually get suggested also
depends on leadership: each company needs a CO and 1SG, each platoon a PL
and PSG, so if you don't have enough officers or senior NCOs tagged yet, the
suggestion shrinks the company count to match rather than proposing more
than you can staff — you'll see a note explaining why when that happens (and
similar notes if there aren't enough squads yet, or not enough junior NCOs
for all the squad-leader slots).

**Apply suggested structure** builds it in one click — squads placed, every
leadership billet left vacant on purpose — and it lands as unsaved changes
on that roster, so you can open it, review, tweak, and Save (or Revert to
throw it away). Then fill leadership top-down: click the vacant Battalion
CO/XO/SGM billets to pick from the officer/NCO lists, and work down through
company and platoon leadership the same way.

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
follow its five phases — tag everyone N/HLLV/HLLWW2, log each squad's
practice time, review each group's leadership, Commit Split, then build
each battalion up from its pool. See
[Splitting the battalion](#splitting-the-battalion-split-planner) above.

**Cleaning up the history:** if a test move or mis-click got saved to the
Change Log, open the Change Log panel and Delete that specific entry, or
Clear All to start the log over.
