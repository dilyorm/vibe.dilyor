import json
import os
import re
import time
from pathlib import Path

import google.generativeai as genai

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

SYSTEM_PROMPT = """You are a careful music listener. You receive ONE audio file and must produce a single JSON object describing it. No prose, no markdown fences, no commentary outside JSON.

Listen to the entire track before answering. Identify the language, then transcribe lyrics by ear, line by line, with the timestamp of when each line BEGINS in the audio.

Return JSON with this exact shape:

{
  "title": "best guess at song title or short descriptive title if unknown",
  "artist": "artist if identifiable, else empty string",
  "language": "primary lyric language (e.g. 'English', 'Uzbek', 'Spanish', 'Instrumental')",
  "lyrics": [
    { "time": 0.0, "text": "lyric line as you actually heard it" }
  ],
  "summary": "2-4 sentences. Plain-language explanation of what the song is ABOUT — the subject, the speaker's stance, what is happening emotionally. Avoid review-speak; write like you are telling a friend.",
  "storyline": {
    "setting": "1 short sentence sketching the scene/place/time the song lives in",
    "characters": [
      { "name": "short label like 'the narrator', 'her', 'the city'", "role": "1 short phrase: what they do or stand for in the song" }
    ],
    "arc": "2-3 short sentences describing how the song moves: where it starts, what shifts in the middle, where it ends"
  },
  "vibe": {
    "name": "2-4 word poetic vibe name (e.g. 'Midnight Neon Drift')",
    "mood": "one-word mood tag (melancholic, euphoric, dreamy, fierce, nostalgic, serene, wistful, defiant, tender, restless...)",
    "description": "1-2 sentence sensory description of how the song FEELS to listen to — texture, atmosphere, body response",
    "palette": {
      "bg_from": "#hex",
      "bg_via": "#hex",
      "bg_to": "#hex",
      "text": "#hex (must be readable on the gradient midpoint)",
      "accent": "#hex"
    },
    "tempo": "slow | mid | fast",
    "energy": "low | medium | high"
  }
}

Hard rules for accuracy:
- LYRICS: transcribe what is actually sung. Do not paraphrase. Do not invent. If a line is unclear, write your best phonetic guess — never fabricate.
- TIMESTAMPS: `time` is seconds from audio start, of when that line begins. Be precise within ~1.5s. Lines should be in chronological order. One sung phrase per entry (roughly 4-12 words). Do NOT clump several lines into one entry.
- Cover repeated choruses each time they occur, with their own timestamps.
- INSTRUMENTAL: if the track has no sung words, return `lyrics: []` and language `"Instrumental"`. The storyline can still describe an imagined scene, but say so honestly in the summary.
- VIBE: the mood and palette must match what the audio actually conveys, not the title or artist. Dark/sad → dark muted palette. Bright/joyful → bright saturated palette. Calm → soft low-contrast. Aggressive → high contrast.
- PALETTE: 5 distinct hex colors that read as a coherent gradient. `text` must have strong contrast against `bg_via`.
- STORYLINE: 1-3 characters max. Keep names short. The arc must reflect the actual song progression you heard.
- Output ONLY the JSON object. No backticks, no explanation, no trailing text.
"""


def _configure():
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")
    genai.configure(api_key=key)


_TRAILING_COMMA = re.compile(r",(\s*[}\]])")
_BAD_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_SMART_QUOTES = str.maketrans({
    "\u201c": '"', "\u201d": '"',
    "\u2018": "'", "\u2019": "'",
})


def _try_loads(s: str) -> dict | None:
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return None


def _parse_json(raw: str) -> dict:
    raw = (raw or "").strip()
    # strip code fences if Gemini wrapped despite instructions
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        raise ValueError(f"No JSON found in model output: {raw[:200]}")
    body = m.group(0)

    # Pass 1: as-is
    parsed = _try_loads(body)
    if parsed is not None:
        return parsed

    # Pass 2: normalize quotes + strip trailing commas + drop bad control chars
    cleaned = body.translate(_SMART_QUOTES)
    cleaned = _TRAILING_COMMA.sub(r"\1", cleaned)
    cleaned = _BAD_CONTROL.sub("", cleaned)
    parsed = _try_loads(cleaned)
    if parsed is not None:
        return parsed

    # Pass 3: try truncating to last balanced brace (Gemini sometimes cuts off)
    last_close = cleaned.rfind("}")
    if last_close > 0:
        parsed = _try_loads(cleaned[: last_close + 1])
        if parsed is not None:
            return parsed

    # Final: surface real error
    json.loads(cleaned)  # raises with detail
    return {}  # unreachable


def analyze_audio(audio_path: Path, mime_type: str) -> dict:
    _configure()
    model = genai.GenerativeModel(MODEL_NAME)

    uploaded = genai.upload_file(path=str(audio_path), mime_type=mime_type)

    deadline = time.time() + 90
    while uploaded.state.name == "PROCESSING" and time.time() < deadline:
        time.sleep(1.5)
        uploaded = genai.get_file(uploaded.name)
    if uploaded.state.name != "ACTIVE":
        raise RuntimeError(f"file not active: state={uploaded.state.name}")

    last_err: Exception | None = None
    for attempt in range(2):
        try:
            resp = model.generate_content(
                [SYSTEM_PROMPT, uploaded],
                generation_config={
                    "response_mime_type": "application/json",
                    # second attempt: lower temp → less creative tokens that
                    # might break JSON
                    "temperature": 0.35 if attempt == 0 else 0.1,
                    "max_output_tokens": 8192,
                },
            )
            result = _parse_json(resp.text)
            try:
                genai.delete_file(uploaded.name)
            except Exception:
                pass
            return result
        except (ValueError, json.JSONDecodeError) as e:
            last_err = e
            continue

    try:
        genai.delete_file(uploaded.name)
    except Exception:
        pass
    raise RuntimeError(f"could not parse Gemini response after retry: {last_err}")
