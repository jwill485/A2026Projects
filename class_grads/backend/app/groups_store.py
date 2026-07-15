import json
from pathlib import Path
from typing import List

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
GROUPS_FILE = DATA_DIR / "groups.json"


def load_groups() -> List[dict]:
    if not GROUPS_FILE.exists():
        return []
    return json.loads(GROUPS_FILE.read_text())


def save_groups(groups: List[dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GROUPS_FILE.write_text(json.dumps(groups, indent=2))
