# Battalion Roster Management System - Design Document

## 1. Product Overview

**Purpose:** A web-based roster management tool for organizing and visualizing battalion structure in the 2-7 Cavalry Regiment (or any military unit). Allows commanding officers and leadership to intuitively map, organize, and manage personnel assignments across hierarchical unit structure.

**Primary User:** Battalion CO and subordinate leaders managing personnel assignments, roster changes, and command structure.

**Key Value:** Single source of truth for battalion composition with real-time visual feedback on unit structure, vacancy tracking, and personnel assignments.

---

## 2. Core Features

### 2.1 Hierarchical Roster View
- **Tree/Org Chart Display:** Interactive visualization showing full battalion structure
  - Battalion level (root)
  - Companies (Able, Baker, Charlie, Easy - expandable/collapsible)
  - Platoons within each company (expandable/collapsible)
  - Squads within each platoon (expandable/collapsible)
  - Individual soldiers within squads

- **Visual Indicators:**
  - Filled positions (show soldier name, rank, role)
  - Vacant positions (empty slot with "VACANT" label)
  - Color coding by status (assigned, vacant, flagged for review)
  - Position count badges (e.g., "3/4 filled")

### 2.2 Soldier Management
- **Add/Edit/Delete Soldiers:**
  - Soldier name, rank, MOS, call sign
  - Status (active, on leave, flagged)
  - Notes/metadata field

- **Drag-and-Drop Assignment:**
  - Drag soldiers from an unassigned pool to open positions
  - Move soldiers between positions
  - Visual feedback during drag operations

### 2.3 Structure Management
- **Customize Unit Composition:**
  - Define/edit company names and structure
  - Set platoon count per company
  - Set squad strength (authorized vs. actual)

- **Template Presets:**
  - Standard US Army structure templates (rifle platoons, HQ platoons, etc.)
  - Load/save custom configurations

### 2.4 Search & Filter
- **Quick Search:** Find soldiers by name, rank, MOS, or call sign
- **Filter:** By company, platoon, status, or vacancy status
- **Sort:** Alphabetically, by rank, by position, etc.

### 2.5 Roster Export/Report
- **Generate Rosters:**
  - Full battalion roster (text/PDF)
  - Company rosters
  - Platoon rosters
  - Officer roster
  - NCO roster

- **Vacancy Report:** List all open positions with slot level/type

### 2.6 Audit/History (Optional - Phase 2)
- Track changes to roster (who moved where, when)
- Version history/rollback capability

---

## 3. Data Model

### 3.1 Core Data Structures

```
Battalion
├── id (UUID)
├── name (string)
├── companies (Company[])
└── soldiers (Soldier[])

Company
├── id (UUID)
├── name (string)
├── designation (string, e.g., "Able Company")
├── commander (Soldier ID or null)
├── platoons (Platoon[])
└── authorized_strength (int)

Platoon
├── id (UUID)
├── name (string)
├── parent_company_id (UUID)
├── platoon_sergeant (Soldier ID or null)
├── squads (Squad[])
└── authorized_strength (int)

Squad
├── id (UUID)
├── name (string)
├── parent_platoon_id (UUID)
├── squad_leader (Soldier ID or null)
├── positions (Position[])
└── authorized_strength (int)

Position
├── id (UUID)
├── parent_squad_id (UUID)
├── title (string, e.g., "Squad Member", "SAW Gunner")
├── assigned_soldier_id (Soldier ID or null)
├── required_rank (string or null)
└── required_mос (string or null)

Soldier
├── id (UUID)
├── name (string)
├── rank (string)
├── mос (string, e.g., "11B")
├── call_sign (string or null)
├── status (enum: "active", "on_leave", "flagged")
├── current_position_id (UUID or null)
└── notes (string or null)
```

### 3.2 Storage
- **Local:** Browser localStorage for quick iteration/demo
- **Backend (Phase 2):** JSON/database backend for persistence across sessions
- **External source:** 7Cav MILPACS API (`api.7cav.us`) as an optional import source for
  identity/rank/position data — see [6.4](#64-external-data-source-7cav-milpacs-api)

---

## 4. UI/UX Layout

### 4.1 Main Interface Layout

```
┌─────────────────────────────────────────────────────┐
│  Battalion Roster Management - 2-7 Cavalry         │
├─────────────────────────────────────────────────────┤
│  [Search Bar] [Filter] [+ Add Soldier] [Export]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  UNASSIGNED SOLDIERS (Left Panel)                  │
│  ┌──────────────────────────────────┐              │
│  │ Total: 5 | Vacant Slots: 12      │              │
│  ├──────────────────────────────────┤              │
│  │ • CPL Johnson (11B)              │ <- Draggable │
│  │ • PVT Martinez (11B)             │              │
│  │ • SPC Taylor (68W)               │              │
│  │ • PVT Chen (11B)                 │              │
│  │ • CPL Brown (11B)                │              │
│  └──────────────────────────────────┘              │
│                                                     │
│  BATTALION STRUCTURE (Center/Right Panel)          │
│  ┌──────────────────────────────────────────────┐  │
│  │ ▼ 2-7 CAVALRY BATTALION [Authorized: 150]   │  │
│  │   ├─ ▼ Able Company [CPL Anderson] (12/14) │  │
│  │   │  ├─ ▼ 1st Platoon (Iron Crucible)      │  │
│  │   │  │  ├─ ▼ 1st Squad                     │  │
│  │   │  │  │  ├─ Squad Leader: SPC Torres    │  │
│  │   │  │  │  ├─ [3 more positions]          │  │
│  │   │  │  │  ├─ [VACANT]                     │  │
│  │   │  │  └─ ▼ 2nd Squad                     │  │
│  │   │  │     ├─ Squad Leader: CPL Brown     │  │
│  │   │  │     ├─ [positions...]              │  │
│  │   │  └─ ▼ 3rd Platoon                      │  │
│  │   │     └─ [collapsed]                    │  │
│  │   ├─ ▼ Baker Company [VACANT] (6/14)      │  │
│  │   ├─ ▼ Charlie Company [SPC Johnson]      │  │
│  │   │  └─ [collapsed]                       │  │
│  │   └─ ▼ Easy Company [VACANT] (8/14)       │  │
│  │      └─ [collapsed]                       │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.2 Key UI Components

**Soldier Card (Unassigned/Position):**
```
┌──────────────────────────┐
│ CPL Johnson              │  <- Rank + Name
│ 11B | Call: "Wrench"     │  <- MOS | Call Sign
│ [Active] [Edit] [Remove] │  <- Status + Actions
└──────────────────────────┘
```

**Position Slot (Vacant):**
```
┌──────────────────────────┐
│ [VACANT]                 │
│ Squad Member             │  <- Position Title
│ Required: PFC or higher  │  <- Requirements (if any)
│ [Drag soldier here]      │  <- Drop target
└──────────────────────────┘
```

**Position Slot (Filled):**
```
┌──────────────────────────┐
│ SPC Torres               │  <- Soldier name
│ Squad Leader (11B)       │  <- Position title (MOS)
│ [Edit] [Remove]          │  <- Actions (can drag to reassign)
└──────────────────────────┘
```

**Stats Summary Bar:**
```
Able Company: 12/14 filled | Baker Company: 6/14 filled | Charlie Company: 10/15 filled | Easy Company: 8/14 filled
Total Battalion: 36/57 filled | Vacant: 21 | On Leave: 2
```

---

## 5. User Workflows

### 5.1 Common Tasks

**Task: Add a new soldier**
1. Click "+ Add Soldier"
2. Fill form: Name, Rank, MOS, Call Sign, Status
3. Soldier appears in "Unassigned Soldiers" pool
4. Drag to desired position OR assign via modal

**Task: Move a soldier between positions**
1. Click and drag soldier from current position to new position
2. System updates hierarchy
3. Previous position becomes vacant
4. Real-time stats update

**Task: Fill a vacant position**
1. Drag unassigned soldier to [VACANT] slot
2. Slot fills with soldier name/rank
3. Soldier removed from unassigned pool

**Task: View roster for a single company**
1. Click "Export" → select "Company Roster"
2. Choose company from dropdown
3. Generate PDF/text file with all soldiers in that company

**Task: View organization-wide vacancy report**
1. Click "Export" → select "Vacancy Report"
2. See all vacant positions listed by company/platoon
3. Filter or export as needed

---

## 6. Technical Architecture

### 6.1 Technology Stack (Recommended)

- **Frontend:** React (or Vue.js)
  - State management: React Context or Zustand for battalion/soldier data
  - Drag-and-drop: React Beautiful DnD or dnd-kit
  - UI components: Custom or shadcn/ui for consistency
  - Tree rendering: Recursive components or recharts/rc-tree

- **Styling:** Tailwind CSS
- **Export:** jsPDF or Puppeteer for PDF generation
- **Storage (Phase 1):** localStorage (JSON serialization)
- **Storage (Phase 2):** Node.js/Express backend + PostgreSQL or MongoDB

### 6.2 Data Flow

```
User Action (drag, edit, delete)
    ↓
React Event Handler
    ↓
Update State (Context/Store)
    ↓
Persist to localStorage
    ↓
Re-render Components
    ↓
Visual Update
```

### 6.3 Key Implementation Challenges

- **Drag-and-drop coordination:** Ensure position swaps, reassignments, and unassigned pool updates work seamlessly
- **Deep nesting rendering:** Efficient re-renders for large rosters with many levels
- **State synchronization:** Keep unassigned pool, positions, and statistics in sync
- **Responsive design:** Support mobile and desktop views (optional: mobile-first for tablet CO usage)

### 6.4 External Data Source: 7Cav MILPACS API

Rather than (or in addition to) manual entry, soldier data can be imported from the
7th Cavalry Regiment's public roster API, `https://api.7cav.us` (source/spec:
[github.com/7Cav/api](https://github.com/7Cav/api)), so the regiment's own personnel
records become the source of truth for identity, rank, and position.

**Auth**
- `Authorization: Bearer <API_KEY>` header on every request.
- The key must live server-side (env var / secrets manager), never in frontend code
  or the repo — it grants read access to full regiment personnel records.
- 401s come back as **plain text** (not JSON), in two forms: header missing/malformed
  vs. a well-formed but unrecognized key.

**Key endpoints** (all under the `milpacs` tag)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/roster/{roster}` | Full profiles (incl. records & awards) for a roster type |
| GET | `/api/v1/roster/{roster}/lite` | Same, minus records/awards — cheaper for populating the tree view |
| GET | `/api/v1/milpacs/awol` | Flat, regiment-wide list of AWOL members |
| GET | `/api/v1/milpacs/profile/id/{userId}` | Single profile by numeric user id |
| GET | `/api/v1/milpacs/profile/username/{username}` | Single profile by username |
| GET | `/api/v1/milpacs/position/groups` | Canonical list of position groups/titles |
| GET | `/api/v1/milpacs/ranks` | Canonical rank list (short/full name, image) |

`{roster}` takes a `RosterType` enum value or its numeric form:
`ROSTER_TYPE_COMBAT`, `ROSTER_TYPE_RESERVE`, `ROSTER_TYPE_ELOA`,
`ROSTER_TYPE_WALL_OF_HONOR`, `ROSTER_TYPE_ARLINGTON`, `ROSTER_TYPE_PAST_MEMBERS`.
`ROSTER_TYPE_COMBAT` is the active roster relevant to this app.

**Response shape** (`LiteRoster`, profiles keyed by milpac relation id):
```
{
  profiles: {
    "<relationId>": {
      user: { userId, username } | null,
      rank: { rankShort, rankFull, rankImageUrl, rankId } | null,
      realName: string,
      uniformUrl: string,
      roster: RosterType,
      primary: { positionTitle, positionId } | null,
      secondaries: [{ positionTitle, positionId }],
      joinDate, promotionDate, discordId, awardDate, recordDate,
      lastForumPostDate, mos, consoleGamertag: string
    }
  }
}
```
The full (non-lite) `Profile` adds `records[]` and `awards[]`.

**Mapping to this app's data model**
- `LiteProfile` → `Soldier`: `rank.rankShort`/`rankFull` → `rank`, `mos` → `mos`,
  `user.username`/`consoleGamertag` → `call_sign`, `realName` → `name`.
- Position/AWOL `groupName` strings encode unit as `{Company}/{Battalion}-{Regiment}`
  (e.g. `A/2-7`). The API has no concept of this app's Company/Platoon/Squad tree —
  it only goes down to "position" — so this app must (1) filter the regiment-wide
  response down to battalion `2-7`, and (2) map the company letter to the local
  nicknames (A→Able, B→Baker, C→Charlie, E→Easy). Platoon/squad structure and
  authorized strengths remain locally defined and maintained.
- No endpoint returns vacant positions directly; vacancies are inferred locally by
  diffing the authorized structure against the `positionId`s the API reports as filled.

**Caching & polling**
- Responses carry `Cache-Control: max-age=600` (10 min) and `Vary: Accept-Encoding`.
  Don't poll more often than every 10 minutes; pair with a manual "Refresh from API"
  button for on-demand syncs.

**Error handling**
- Non-401 errors share one JSON shape: `{ code, message, details }`, with `code`
  3 / 5 / 7 / 13 mapping to HTTP 400 / 404 / 403 / 500.
- 401s are plain text, not JSON — handle as a separate case.

**Sync strategy**
- Treat the API as read-only source of truth for identity/rank/position; local state
  stays authoritative for structure (platoons/squads) and app-only fields (notes,
  flags, local leave status) until/unless a write-back endpoint exists.
- Match imported soldiers to existing local records by `userId` first, falling back
  to username (real names can change).

---

## 7. UI/UX Principles

- **Intuitive hierarchy:** Use indentation, color, and icons to show chain of command
- **Drag-and-drop first:** Minimize form-filling; prefer direct manipulation
- **Real-time feedback:** Numbers update instantly; no "save" button needed
- **Clear status:** Color-code vacancies, availability, flags for quick scanning
- **Context menu actions:** Right-click on positions/soldiers for quick actions (edit, remove, move)
- **Undo/Redo (Phase 2):** Support quick corrections

---

## 8. Optional Phase 2 Features

- **Rank validation:** Prevent assigning E1 to squad leader roles
- **MOS matching:** Flag positions filled by soldiers with mismatched MOS
- **Attendance tracking:** Mark soldiers as present/absent for formations
- **Leave management:** Toggle soldiers on/off for leave periods
- **Notes/flags:** Highlight soldiers for review (medical, discipline, promotion)
- **Backup rosters:** Save snapshots of roster state
- **Multi-battalion support:** Manage multiple units in one app
- **User authentication:** Multi-user access with role-based permissions
- **Change log:** Audit trail of roster changes with timestamps

### 8.1 Planned: Battalion Split (2-7 → Two Battalions)

2-7 Cavalry is expected to eventually split into **two** battalions, each with its
own companies. Working names so far: **HLLV** and **HLLWW2**. During the
transition, the app should show **three groups**: HLLV, HLLWW2, and an
**Unassigned** group holding any company not yet placed into one of the two new
battalions — the same pattern already used for individual soldiers (B/ACD →
Unassigned pool), but one level up (companies, not soldiers).

This needs a **Group layer** above Company in the data model (today there's one
implicit group — 2-7 — holding all four companies; this would generalize to N
groups, each holding a subset of companies, with company-to-group reassignment
working like the existing soldier move engine). Decided approach: **do this on a
separate git branch** when the split becomes active work, rather than
restructuring the data model on `master` speculatively — keeps `master` stable
if the branch needs to be reworked or abandoned.

### 8.2 Planned: Org Chart View

A visual box-and-connector org chart (Battalion → Company → Platoon → Squad),
as an alternative to the current text-tree view. Scoped to **read-only,
finished rosters only** — generated for the live Battalion Roster tab, or for
a custom roster once it's considered "complete," not for a blank/in-progress
custom roster mid-build. Leaning toward a hand-built CSS/SVG tree layout
(consistent with the hand-built `Charts.tsx`, no new charting dependency)
rather than pulling in a diagramming library. Not yet started.

### 8.3 Done: Multiple Named Rosters

Users can configure and save several distinct rosters under their own names
and switch between them, instead of the app having exactly one "current"
roster. `persistence.ts` namespaces roster/baseline/change-log by a generated
roster id (`roster-manager:roster:<id>` etc.) plus a small index
(`roster-manager:index`) and active-id pointer; a one-time
`migrateLegacyStorage()` wraps any pre-existing single-roster data into the
first named entry ("2-7 Cavalry Battalion") so nothing already saved locally
is lost. A `RosterPicker` component in the top bar (left of the tab box)
provides the roster `<select>` plus **+ New Roster** (blank or duplicate the
active roster), **Rename**, and **Delete** (disabled when only one roster
remains). The old destructive "Start Blank Roster" button was removed in
favor of the non-destructive "+ New Roster" flow. Drag & Drop, the change
log, and analytics needed no changes — they already operate generically on
whichever `RosterData` is active.

---

## 9. Success Metrics

- **Ease of use:** New user can assign all soldiers to positions in < 5 minutes
- **Speed:** Roster changes reflected and exported in < 30 seconds
- **Accuracy:** No data loss or inconsistencies during drag-and-drop operations
- **Flexibility:** Supports custom unit structures (non-standard company sizes, unique platoon arrangements)

---

## 10. Open Questions / Assumptions

1. **Data persistence:** Should rosters be saved automatically to cloud, or only locally?
2. **Multi-user:** Will multiple leaders access the same roster simultaneously (real-time sync needed)?
3. **Rank structure:** Should we hard-code US Army rank structure, or allow customization for milsim variations? *(Partially resolved: the MILPACS API supplies rank name/image per profile for combat-roster members, but this app still needs its own rank list for soldiers entered manually.)*
4. **Export formats:** Priority on PDF, text, or spreadsheet export?
5. **Mobile support:** Essential for tablet access in the field, or desktop-only initially?
6. **Learning/alternate structures:** Does 2-7 use non-standard unit organization (e.g., extra platoons, different squad sizes)?
7. **API key hosting:** This app needs a backend/proxy layer to hold the MILPACS API bearer token server-side — is a Phase 1 backend in scope, or does Phase 1 stay client-only and defer the live API import to Phase 2?
8. **Company-letter mapping stability:** Is the `A/B/C/E → Able/Baker/Charlie/Easy` mapping fixed, or could 2-7's lettering change (e.g. a Delta company added later)?

---

## 11. Getting Started for Development

1. **Create React app** with Vite or CRA
2. **Design data model** in TypeScript (define types for Battalion, Company, Soldier, etc.)
3. **Build core UI skeleton** (unassigned pool + expandable tree)
4. **Implement drag-and-drop** (start with simple drag-to-position assignment)
5. **Add CRUD operations** (add/edit/delete soldiers, modify structure)
6. **Implement export** (generate text/PDF rosters)
7. **Polish and refactor** (undo/redo, error handling, responsive design)

### 11.1 Planned: End-State Architecture Sketch

Once the app reaches a feature-complete/final version (org chart view, named
multi-roster support, etc. all landed), produce a single architecture diagram
summarizing the finished system: frontend (React/Vite) ↔ backend proxy
(FastAPI) ↔ 7Cav MILPACS API, plus the client-side persistence/data-flow layer
(localStorage-backed roster/baseline/change-log, the move engine, and the
active-roster picker once built). Deferred until the shape of the finished
system is settled, rather than sketched against a moving target now.

---

## Appendix A: Example Battalion Structure (2-7 Cavalry)

```
2-7 CAVALRY BATTALION (CO: Colonel Cam)
├── Battalion HQ
│   ├── Commanding Officer (Colonel Cam)
│   ├── Executive Officer (Captain)
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

## Appendix B: Sample Soldier Data (for testing/demo)

```
[
  { name: "Torres", rank: "SPC", mос: "11B", callSign: "Tiger", status: "active" },
  { name: "Anderson", rank: "CPL", mос: "11B", callSign: "Ghost", status: "active" },
  { name: "Brown", rank: "CPL", mос: "11B", callSign: "Wrench", status: "active" },
  { name: "Johnson", rank: "SPC", mос: "11B", callSign: "Recon", status: "active" },
  { name: "Martinez", rank: "CPT", mос: "11A", callSign: null, status: "active" },
  { name: "Chen", rank: "PVT", mос: "11B", callSign: "Echo", status: "on_leave" },
  { name: "Davis", rank: "CPL", mос: "11B", callSign: "Hammer", status: "active" },
  { name: "Williams", rank: "PFC", mос: "11B", callSign: null, status: "active" }
]
```
