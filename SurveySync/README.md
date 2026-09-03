# SurveySync

A Google Apps Script, bound to the survey's response Sheet, that pulls the
live 2-7 Cavalry roster from the 7Cav MILPACS API and cross-references it
against who has filled out the survey — producing a full roster tab tagged
Responded/Not Responded, plus a standalone punch-list tab of just the
outstanding people.

Separate from the RosterManager app — this is a standalone script that runs
inside Google's infrastructure (no local server, no credentials to manage
beyond the one API key), not part of that codebase.

## Why Apps Script instead of a local script

The Sheet already exists with a linked Form; Apps Script runs bound to it
with built-in access (no separate Google Cloud project, service account, or
OAuth flow to set up) and can be triggered on a schedule or from a menu
inside the Sheet itself. The only secret it needs is the same 7Cav MILPACS
API key RosterManager's backend already holds server-side — stored here in
Apps Script's Script Properties, which plays the same role.

## Setup (one time)

1. Open the Google Sheet the survey Form writes its responses into.
2. **Extensions → Apps Script.** Delete the default empty `Code.gs` and
   paste in this folder's [`Code.gs`](Code.gs).
3. In the Apps Script editor, click **Project Settings** (gear icon) →
   **Show "appsscript.json" manifest file in editor** → paste in this
   folder's [`appsscript.json`](appsscript.json), replacing its
   `timeZone` with your own (it only affects what hour the daily
   trigger fires at).
4. Still in **Project Settings**, scroll to **Script Properties** → add one:
   - Name: `MILPACS_API_KEY`
   - Value: the same API key value from RosterManager's root `.env`
     (`MILPACS_API_KEY=...`)
5. Back in `Code.gs`, check the `CONFIG` block at the top against your
   actual Sheet:
   - `RESPONSES_SHEET_NAME` — the tab name the Form writes to. Google Forms
     defaults to `Form Responses 1`; rename this if yours is different.
   - `RESPONSES_NAME_COLUMN_HEADER` — the exact header text of the
     question asking for their name (defaults to `Name (Rnk.Last.F)`,
     matching the current survey). Set it to `null` to instead
     auto-match the first header containing the word "name".
6. In the Apps Script editor's function dropdown (top toolbar), select
   `refreshRosterAndStatus` and click **Run**. The first run prompts for
   authorization (it needs to call an external API and edit the Sheet) —
   review and approve it.
7. Reload the Sheet. A **Roster Sync** menu now appears with:
   - **Refresh now** — re-run the sync any time.
   - **Install daily auto-refresh** — schedules `refreshRosterAndStatus`
     to run automatically once a day (edit `DAILY_REFRESH_HOUR` in the
     `CONFIG` block first if 6am script-time isn't what you want).

## What it produces

- **Roster** tab — every trooper currently on the live combat roster
  (Username, Real Name, Rank, MOS, Company, Platoon, Squad, Role, Survey
  Response, Responded At), not-responded rows sorted to the top.
- **Not Responded** tab — just the outstanding names, for a quick
  leader-facing punch list.

Both are fully overwritten on each refresh — this is a point-in-time
snapshot + status, not an accumulating log.

## Matching logic

The survey names people `Rank.Last.F` (e.g. `Pfc.Melon.DJ`) rather than the
bare `Last.F` MILPACS username, so each response is matched against the
roster by trying the name both with and without its leading rank segment —
the same trick RosterManager's own CSV tag importer
(`RosterManager/frontend/src/lib/splitTagImport.ts`) uses for the same
real-world data shape. Matching falls back to real name if no username
match is found.

**This is name-string matching, not a guaranteed identity match** — a typo,
an unusual name format, or a rank abbreviation this script doesn't
recognize as a prefix will show someone as "Not Responded" even if they did
respond. Spot-check the **Not Responded** tab against the raw response
sheet before treating it as a final list, especially early on.

## Files

- `Code.gs` — the script itself.
- `appsscript.json` — project manifest (timezone + OAuth scopes); only
  needed if you want to edit those from their defaults.
