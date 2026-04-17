"""Download audio from a URL (YouTube, SoundCloud, Yandex, etc.) via yt-dlp, plus search."""

from __future__ import annotations

import mimetypes
import os
from pathlib import Path
from typing import Any, Optional

import yt_dlp


_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_COOKIE_PATHS = [
    _REPO_ROOT / "cookies.txt",
    Path(__file__).resolve().parent / "cookies.txt",
]


def _cookie_opts() -> dict[str, Any]:
    """Locate cookies for yt-dlp so YouTube stops asking 'are you a bot?'.

    Priority:
      1. YTDLP_COOKIES_FROM_BROWSER env (e.g. 'firefox' or 'firefox:Default')
      2. YTDLP_COOKIES_FILE env path
      3. cookies.txt at repo root or backend/ folder (auto-detected)
    """
    opts: dict[str, Any] = {}
    browser = os.getenv("YTDLP_COOKIES_FROM_BROWSER", "").strip()
    cookies_file = os.getenv("YTDLP_COOKIES_FILE", "").strip()
    if browser:
        opts["cookiesfrombrowser"] = tuple(browser.split(":"))
        return opts
    if cookies_file and Path(cookies_file).exists():
        opts["cookiefile"] = cookies_file
        return opts
    for p in _DEFAULT_COOKIE_PATHS:
        if p.exists():
            opts["cookiefile"] = str(p)
            return opts
    return opts

MAX_DURATION_SEC = 15 * 60
SUPPORTED_EXT = {".mp3", ".m4a", ".webm", ".ogg", ".opus", ".wav", ".flac", ".aac"}


class IngestError(RuntimeError):
    pass


def download_audio(url: str, dest_no_ext: Path) -> tuple[Path, str, dict]:
    """Download best audio stream. Returns (path, mime_type, info)."""
    opts = {
        "format": "bestaudio/best",
        "outtmpl": str(dest_no_ext) + ".%(ext)s",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "nocheckcertificate": True,
        "restrictfilenames": True,
        **_cookie_opts(),
    }

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        raise IngestError(f"could not read link: {e}") from e

    duration = info.get("duration") or 0
    if duration and duration > MAX_DURATION_SEC:
        raise IngestError(f"track too long ({duration}s, max {MAX_DURATION_SEC}s)")

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except Exception as e:
        raise IngestError(f"download failed: {e}") from e

    # resolve actual downloaded file path
    downloaded: Optional[Path] = None
    ext_hint = info.get("ext") or ""
    candidate = Path(str(dest_no_ext) + "." + ext_hint) if ext_hint else None
    if candidate and candidate.exists():
        downloaded = candidate
    else:
        for p in dest_no_ext.parent.glob(dest_no_ext.name + ".*"):
            downloaded = p
            break

    if not downloaded or not downloaded.exists():
        raise IngestError("downloaded file not found")

    ext = downloaded.suffix.lower()
    if ext not in SUPPORTED_EXT:
        downloaded.unlink(missing_ok=True)
        raise IngestError(f"unsupported audio format from source: {ext}")

    mime = mimetypes.guess_type(downloaded.name)[0] or "audio/mpeg"

    meta = {
        "title": info.get("title") or "",
        "uploader": info.get("uploader") or info.get("channel") or "",
        "duration": duration,
        "source_url": url,
        "webpage_url": info.get("webpage_url") or url,
        "thumbnail": info.get("thumbnail"),
    }
    return downloaded, mime, meta


def _best_thumb(entry: dict[str, Any]) -> Optional[str]:
    thumbs = entry.get("thumbnails") or []
    if not thumbs:
        return entry.get("thumbnail")
    # pick a medium-sized thumb
    scored = [(t.get("width") or 0, t.get("url")) for t in thumbs if t.get("url")]
    scored.sort()
    for w, url in scored:
        if w >= 240:
            return url
    return scored[-1][1] if scored else None


def search(query: str, limit: int = 6) -> list[dict[str, Any]]:
    """Fast flat YouTube search. Returns compact result dicts."""
    q = (query or "").strip()
    if not q:
        return []

    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "skip_download": True,
        "default_search": f"ytsearch{limit}",
        **_cookie_opts(),
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"ytsearch{limit}:{q}", download=False)
    except Exception as e:
        raise IngestError(f"search failed: {e}") from e

    entries = (info or {}).get("entries") or []
    out: list[dict[str, Any]] = []
    for e in entries:
        if not e:
            continue
        vid = e.get("id") or ""
        url = e.get("url") or (f"https://www.youtube.com/watch?v={vid}" if vid else None)
        if not url:
            continue
        out.append(
            {
                "id": vid,
                "title": e.get("title") or "",
                "channel": e.get("channel") or e.get("uploader") or "",
                "duration": e.get("duration") or 0,
                "thumbnail": _best_thumb(e),
                "url": url,
            }
        )
    return out

