FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# yt-dlp needs:
#   ffmpeg     — remux/concat audio
#   nodejs     — solve YouTube's JS signature/n-challenges
#   ca-certs   — TLS
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates nodejs \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

# Persisted audio + JSON DB. Mount a volume here in prod.
RUN mkdir -p /app/data/audio
VOLUME ["/app/data"]

# Run as non-root
RUN useradd --create-home --shell /bin/bash app \
 && chown -R app:app /app
USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; \
    sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health',timeout=3).status==200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
