import json
import os
from pathlib import Path
from threading import Lock

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
(DATA_DIR / "audio").mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "vibes.json"

_lock = Lock()


def _load():
    if not DB_PATH.exists():
        return {"vibes": []}
    with open(DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(data):
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def list_vibes():
    with _lock:
        data = _load()
    return sorted(data["vibes"], key=lambda v: v.get("created_at", 0), reverse=True)


def get_vibe(vibe_id: str):
    with _lock:
        data = _load()
    for v in data["vibes"]:
        if v["id"] == vibe_id:
            return v
    return None


def save_vibe(vibe: dict):
    with _lock:
        data = _load()
        data["vibes"] = [v for v in data["vibes"] if v["id"] != vibe["id"]]
        data["vibes"].append(vibe)
        _save(data)
    return vibe


def add_rating(vibe_id: str, stars: int) -> dict | None:
    with _lock:
        data = _load()
        for v in data["vibes"]:
            if v["id"] == vibe_id:
                ratings = v.setdefault("ratings", [])
                ratings.append(int(stars))
                v["avg_rating"] = round(sum(ratings) / len(ratings), 2)
                v["num_ratings"] = len(ratings)
                _save(data)
                return v
    return None


def audio_path(vibe_id: str, ext: str) -> Path:
    return DATA_DIR / "audio" / f"{vibe_id}{ext}"
