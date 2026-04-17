import mimetypes
import os
import re
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import cover as cover_mod
import gemini_vibe
import ingest
import storage

load_dotenv()

app = FastAPI(title="Vibe")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXT = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".webm", ".opus"}


class RatingIn(BaseModel):
    stars: int


class ShareIn(BaseModel):
    name: str


class UrlIn(BaseModel):
    url: str
    title_hint: str = ""


@app.get("/api/health")
def health():
    return {"ok": True, "key_set": bool(os.getenv("GEMINI_API_KEY"))}


@app.get("/api/search")
def search_tracks(q: str = "", limit: int = 6):
    q = (q or "").strip()
    if not q:
        return {"results": []}
    if len(q) > 200:
        raise HTTPException(400, "query too long")
    limit = max(1, min(limit, 10))
    try:
        results = ingest.search(q, limit=limit)
    except ingest.IngestError as e:
        raise HTTPException(502, str(e))
    return {"results": results}


def _list_view(v: dict) -> dict:
    return {
        "id": v["id"],
        "title": v.get("title"),
        "artist": v.get("artist"),
        "vibe": v.get("vibe"),
        "status": v.get("status"),
        "avg_rating": v.get("avg_rating", 0),
        "num_ratings": v.get("num_ratings", 0),
        "creator_name": v.get("creator_name"),
        "created_at": v.get("created_at"),
        "cover_url": v.get("cover_url") or v.get("thumbnail"),
    }


@app.get("/api/vibes")
def list_vibes():
    return [_list_view(v) for v in storage.list_vibes()]


@app.get("/api/vibes/{vibe_id}/similar")
def similar_vibes(vibe_id: str, limit: int = 6):
    target = storage.get_vibe(vibe_id)
    if not target:
        raise HTTPException(404, "vibe not found")

    target_meta = target.get("vibe") or {}
    target_mood = (target_meta.get("mood") or "").lower()
    target_tempo = (target_meta.get("tempo") or "").lower()
    target_energy = (target_meta.get("energy") or "").lower()

    scored: list[tuple[float, dict]] = []
    for v in storage.list_vibes():
        if v["id"] == vibe_id or v.get("status") != "ready":
            continue
        meta = v.get("vibe") or {}
        score = 0.0
        if (meta.get("mood") or "").lower() == target_mood and target_mood:
            score += 3.0
        if (meta.get("tempo") or "").lower() == target_tempo and target_tempo:
            score += 1.5
        if (meta.get("energy") or "").lower() == target_energy and target_energy:
            score += 1.0
        # rating boost (popular tracks float up)
        score += min(v.get("avg_rating", 0), 5) * 0.2
        if score > 0:
            scored.append((score, v))

    scored.sort(key=lambda x: x[0], reverse=True)
    limit = max(1, min(limit, 24))
    return [_list_view(v) for _, v in scored[:limit]]


@app.get("/api/vibes/{vibe_id}")
def get_vibe(vibe_id: str):
    v = storage.get_vibe(vibe_id)
    if not v:
        raise HTTPException(404, "vibe not found")
    return v


@app.get("/api/vibes/{vibe_id}/audio")
def get_audio(vibe_id: str):
    v = storage.get_vibe(vibe_id)
    if not v:
        raise HTTPException(404, "vibe not found")
    ext = v.get("audio_ext", ".mp3")
    path = storage.audio_path(vibe_id, ext)
    if not path.exists():
        raise HTTPException(404, "audio missing")
    return FileResponse(str(path), media_type=v.get("mime_type", "audio/mpeg"))


@app.post("/api/vibes/{vibe_id}/rate")
def rate(vibe_id: str, body: RatingIn):
    if body.stars < 1 or body.stars > 5:
        raise HTTPException(400, "stars must be 1..5")
    v = storage.add_rating(vibe_id, body.stars)
    if not v:
        raise HTTPException(404, "vibe not found")
    return {"avg_rating": v["avg_rating"], "num_ratings": v["num_ratings"]}


@app.post("/api/vibes/{vibe_id}/share")
def share(vibe_id: str, body: ShareIn):
    name = (body.name or "").strip()[:60]
    if not name:
        raise HTTPException(400, "name required")
    v = storage.get_vibe(vibe_id)
    if not v:
        raise HTTPException(404, "vibe not found")
    v["creator_name"] = name
    storage.save_vibe(v)
    return {"creator_name": name, "share_path": f"/vibe/{vibe_id}"}


def _process(vibe_id: str, path: Path, mime: str):
    try:
        result = gemini_vibe.analyze_audio(path, mime)
        existing = storage.get_vibe(vibe_id) or {}
        vibe_meta = result.get("vibe") or {}

        # If we have a cover thumbnail, derive palette from it and override
        # whatever Gemini guessed. Cover-derived palette is far more accurate
        # and prevents the page from rendering as a black void.
        cover_url = existing.get("thumbnail") or existing.get("cover_url")

        # For uploaded files we have no cover. Search YouTube for the
        # title+artist Gemini just identified and steal that cover's colors.
        if not cover_url:
            title_q = (result.get("title") or existing.get("title") or "").strip()
            artist_q = (result.get("artist") or "").strip()
            query = f"{artist_q} {title_q}".strip() if artist_q else title_q
            if query and len(query) >= 3:
                try:
                    hits = ingest.search(query, limit=1)
                    if hits and hits[0].get("thumbnail"):
                        cover_url = hits[0]["thumbnail"]
                except Exception:
                    pass

        if cover_url:
            extracted = cover_mod.palette_from_url(cover_url)
            if extracted:
                vibe_meta["palette"] = extracted
                existing["cover_palette"] = extracted

        existing.update(
            {
                "title": result.get("title") or existing.get("title") or "Untitled",
                "artist": result.get("artist") or existing.get("artist") or "",
                "language": result.get("language") or "",
                "lyrics": result.get("lyrics") or [],
                "summary": result.get("summary") or "",
                "storyline": result.get("storyline") or {},
                "vibe": vibe_meta,
                "cover_url": cover_url,
                "status": "ready",
                "error": None,
            }
        )
        storage.save_vibe(existing)
    except Exception as e:
        v = storage.get_vibe(vibe_id) or {"id": vibe_id}
        v["status"] = "error"
        v["error"] = str(e)
        storage.save_vibe(v)


def _new_vibe_record(vibe_id: str, title: str, artist: str, ext: str, mime: str, extras: dict | None = None):
    base = {
        "id": vibe_id,
        "title": title or "Untitled",
        "artist": artist or "",
        "status": "processing",
        "audio_ext": ext,
        "mime_type": mime,
        "created_at": int(time.time()),
        "lyrics": [],
        "vibe": {},
        "ratings": [],
        "avg_rating": 0,
        "num_ratings": 0,
    }
    if extras:
        base.update(extras)
    storage.save_vibe(base)


@app.post("/api/vibes")
async def upload(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title_hint: str = Form(""),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"unsupported file type {ext}")

    vibe_id = uuid.uuid4().hex[:12]
    dest = storage.audio_path(vibe_id, ext)
    content = await file.read()
    if not content:
        raise HTTPException(400, "empty file")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(400, "file too large (25MB max)")
    dest.write_bytes(content)

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "audio/mpeg"
    _new_vibe_record(
        vibe_id,
        title_hint or file.filename or "Untitled",
        "",
        ext,
        mime,
        {"source": "upload", "original_filename": file.filename},
    )
    background.add_task(_process, vibe_id, dest, mime)
    return {"id": vibe_id, "status": "processing"}


URL_RE = re.compile(r"^https?://", re.IGNORECASE)


@app.post("/api/vibes/from-url")
def from_url(body: UrlIn, background: BackgroundTasks):
    url = (body.url or "").strip()
    if not URL_RE.match(url):
        raise HTTPException(400, "invalid url")

    low = url.lower()
    if "open.spotify.com" in low or "spotify:" in low:
        raise HTTPException(
            400,
            "Spotify doesn't allow full-track downloads. Paste a YouTube / SoundCloud / Bandcamp link instead.",
        )

    vibe_id = uuid.uuid4().hex[:12]
    dest_no_ext = storage.audio_path(vibe_id, "")  # base path w/o extension
    dest_no_ext = dest_no_ext.with_suffix("")

    try:
        path, mime, meta = ingest.download_audio(url, dest_no_ext)
    except ingest.IngestError as e:
        raise HTTPException(400, str(e))

    ext = path.suffix.lower()
    _new_vibe_record(
        vibe_id,
        body.title_hint or meta.get("title") or "Untitled",
        meta.get("uploader", ""),
        ext,
        mime,
        {"source": "url", "source_url": meta.get("source_url"), "webpage_url": meta.get("webpage_url"), "thumbnail": meta.get("thumbnail")},
    )
    background.add_task(_process, vibe_id, path, mime)
    return {"id": vibe_id, "status": "processing"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
