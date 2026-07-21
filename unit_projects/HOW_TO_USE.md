# Unit Projects — How to Use

Framework only right now — see `unit_projects_design_doc.md`. There's no
standalone frontend for this project; it's viewed through the hub at
`/projects` (see `../hub/HOW_TO_USE.md` for running everything together).

## Running just the backend

Useful for testing the API directly without starting the whole hub:

```
cd "C:\Users\cskat\OneDrive\Desktop\7Cav\a2026Projects\unit_projects\backend"
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8002
```

Then `http://localhost:8002/api/projects` returns `[]` — the only
endpoint that exists so far.

## First-time setup

```
cd "C:\Users\cskat\OneDrive\Desktop\7Cav\a2026Projects\unit_projects\backend"
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```
