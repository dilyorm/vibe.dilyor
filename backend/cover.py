"""Fetch a cover image and pull a 5-color palette out of it."""

from __future__ import annotations

import colorsys
import io
from typing import Optional, TypedDict

import httpx
from PIL import Image


class Palette(TypedDict):
    bg_from: str
    bg_via: str
    bg_to: str
    text: str
    accent: str


_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123.0 Safari/537.36"
    )
}


def fetch_image(url: str, timeout: float = 8.0) -> Optional[Image.Image]:
    if not url:
        return None
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True, headers=_HEADERS) as c:
            r = c.get(url)
            r.raise_for_status()
            img = Image.open(io.BytesIO(r.content)).convert("RGB")
            return img
    except Exception:
        return None


def _hex(rgb: tuple[int, int, int]) -> str:
    r, g, b = rgb
    return f"#{r:02x}{g:02x}{b:02x}"


def _luma(rgb: tuple[int, int, int]) -> float:
    r, g, b = (c / 255 for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _shift(rgb: tuple[int, int, int], dl: float = 0.0, ds: float = 0.0) -> tuple[int, int, int]:
    r, g, b = (c / 255 for c in rgb)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = max(0.0, min(1.0, l + dl))
    s = max(0.0, min(1.0, s + ds))
    nr, ng, nb = colorsys.hls_to_rgb(h, l, s)
    return (int(nr * 255), int(ng * 255), int(nb * 255))


def _quantize(img: Image.Image, k: int = 6) -> list[tuple[int, int, int, int]]:
    """Return list of (r, g, b, count) sorted by frequency, ignoring near-grey/black/white."""
    img = img.copy()
    img.thumbnail((220, 220))
    q = img.convert("P", palette=Image.ADAPTIVE, colors=k)
    palette = q.getpalette() or []
    color_counts = q.getcolors(maxcolors=k * 4) or []
    out: list[tuple[int, int, int, int]] = []
    for count, idx in sorted(color_counts, reverse=True):
        r, g, b = palette[idx * 3 : idx * 3 + 3]
        out.append((r, g, b, count))
    return out


def _vibrant_pick(colors: list[tuple[int, int, int, int]]) -> Optional[tuple[int, int, int]]:
    """Pick the most saturated, mid-luma color for accent."""
    best = None
    best_score = -1.0
    for r, g, b, count in colors:
        rr, gg, bb = (c / 255 for c in (r, g, b))
        h, l, s = colorsys.rgb_to_hls(rr, gg, bb)
        # prefer saturation, mid lightness
        score = s * (1 - abs(0.5 - l)) * (count ** 0.3)
        if score > best_score:
            best_score = score
            best = (r, g, b)
    return best


def palette_from_image(img: Image.Image) -> Palette:
    colors = _quantize(img, k=6)
    if not colors:
        return _fallback_palette()

    # darkest pair → background gradient endpoints; saturated → accent
    sorted_by_luma = sorted(colors, key=lambda c: _luma(c[:3]))
    darkest = sorted_by_luma[0][:3]
    second = sorted_by_luma[1][:3] if len(sorted_by_luma) > 1 else darkest
    accent = _vibrant_pick(colors) or sorted_by_luma[-1][:3]

    # nudge backgrounds darker so text pops
    bg_from = _shift(darkest, dl=-0.12)
    bg_via = _shift(second, dl=-0.05, ds=0.05)
    bg_to = _shift(darkest, dl=-0.18)

    # text: white if bg dark, near-black if bg light
    bg_mid_luma = _luma(bg_via)
    text_rgb = (245, 245, 247) if bg_mid_luma < 0.5 else (15, 15, 20)

    # punch up accent
    accent_punched = _shift(accent, dl=0.08, ds=0.15)

    return {
        "bg_from": _hex(bg_from),
        "bg_via": _hex(bg_via),
        "bg_to": _hex(bg_to),
        "text": _hex(text_rgb),
        "accent": _hex(accent_punched),
    }


def _fallback_palette() -> Palette:
    return {
        "bg_from": "#0b0b10",
        "bg_via": "#1a1625",
        "bg_to": "#0b0b10",
        "text": "#f5f5f7",
        "accent": "#b794f6",
    }


def palette_from_url(url: str) -> Optional[Palette]:
    img = fetch_image(url)
    if not img:
        return None
    return palette_from_image(img)
