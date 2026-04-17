# vibe

Drop a song. Get its vibe — lyrics, palette, mood, storyline — on a page that *feels* like the track.

- **Backend:** FastAPI + Google Gemini (`gemini-2.5-flash`) — audio in, JSON out (lyrics with timestamps, palette, summary, storyline)
- **Frontend:** Next.js 14 + Tailwind, reactive gradient backdrop that drifts with the song
- **Storage:** local JSON + audio files (zero infra to run)

## Local setup

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# edit .env, paste your Gemini key (https://aistudio.google.com/apikey)

python main.py
```

Runs on `http://127.0.0.1:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Frontend rewrites `/api/*` to the backend.

### YouTube cookies (optional)

To use the search/URL flow against YouTube without hitting the bot wall, drop a Netscape-format `cookies.txt` at the repo root. It is auto-detected and gitignored. Or set `YTDLP_COOKIES_FROM_BROWSER=firefox` in `backend/.env`.

## Run with Docker

```bash
cp backend/.env.example backend/.env
# edit backend/.env

docker compose up --build
```

`http://localhost:3000` for the app, `http://localhost:8000/api/health` for the API. Audio + JSON DB persist under `backend/data/`.

For YouTube cookies in Docker, create `docker-compose.override.yml` (gitignored) using the snippet inside `docker-compose.yml`.

## CI / CD

- `.github/workflows/ci.yml` — type-checks frontend, builds Next, sanity-imports backend, builds both Docker images on every push and PR.
- `.github/workflows/deploy.yml` — on push to `main` and version tags, builds and pushes both images to GHCR (`ghcr.io/<owner>/vibe.dilyor-backend` and `-frontend`).

Set repo variable `NEXT_PUBLIC_API_URL` to the public backend URL for production builds.

## How it works

1. User uploads a file, pastes a URL, or searches YouTube.
2. Backend stores the audio, returns an id immediately, kicks off Gemini analysis in the background.
3. Gemini returns one JSON: lyrics with timestamps, palette, mood, summary (what the song is about), storyline (setting + characters + arc).
4. Vibe page polls every 2.5s. Once ready it renders the lyrics scroll, the reactive gradient backdrop, the summary, and the storyline.

## Notes

- Max upload: 25 MB.
- Supported: mp3, wav, m4a, ogg, flac, aac, webm, opus.
- Lyric timestamps land within ~1.5s on most tracks. Instrumental tracks show a quiet message instead of lyrics.
- All data stored under `backend/data/`. Delete that folder to reset.

## Security

`cookies.txt`, `.env`, and `backend/data/` are gitignored. Never commit them. If you accidentally push a key, rotate it immediately at https://aistudio.google.com/apikey.
