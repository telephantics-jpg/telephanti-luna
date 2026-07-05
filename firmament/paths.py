"""Project folders — keeps data, docs, and scripts in predictable places."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DOCS = ROOT / "docs"
SCRIPTS = ROOT / "scripts"
LOGS = ROOT / "logs"

_DATA_FILES = (
    "firmament_state.json",
    "firmament_agent_memory.json",
    "firmament_camp_memory.json",
    "firmament_game_state.json",
    "firmament_psychic_state.json",
    "luna_stats.json",
    "pet_settings.json",
    "omni_buddy_state.json",
    "luna_quantum_lines.json",
)


def ensure_dirs() -> None:
    DATA.mkdir(exist_ok=True)
    DOCS.mkdir(exist_ok=True)
    SCRIPTS.mkdir(exist_ok=True)
    LOGS.mkdir(exist_ok=True)


def data_file(name: str) -> Path:
    ensure_dirs()
    dest = DATA / name
    if not dest.exists():
        legacy = ROOT / name
        if legacy.exists():
            shutil.move(str(legacy), str(dest))
    return dest


def script_path(name: str) -> Path:
    ensure_dirs()
    p = SCRIPTS / name
    if p.exists():
        return p
    return ROOT / name