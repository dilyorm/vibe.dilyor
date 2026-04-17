"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LyricLine, Palette, Storyline } from "@/lib/types";

/**
 * Inline Instagram-story poster (1080x1920). Shown directly on the outro
 * slide (no modal) so the user sees what they're about to share before
 * tapping "share to your stories."
 *
 * Layout top → bottom:
 *   1. "{initials}'s vibe for" tiny label
 *   2. Song title — huge
 *   3. Cover art (square, rounded)
 *   4. Vibe name in italic
 *   5. One striking lyric line
 *   6. Palette swatches
 *   7. Vanity URL
 */
export default function Poster({
  vibeId,
  title,
  vibeName,
  mood,
  artist,
  palette,
  lyrics,
  storyline,
  sharePath,
  coverUrl,
  initials,
}: {
  vibeId: string;
  title: string;
  vibeName?: string;
  mood?: string;
  artist?: string;
  palette: Palette;
  lyrics: LyricLine[];
  storyline?: Storyline;
  sharePath?: string | null;
  coverUrl?: string | null;
  initials?: string | null;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const renderedFor = useRef<string>("");

  const handle = initials || (sharePath?.split("/")[1] ?? "");
  const headerLabel = handle ? `${handle}'s vibe for` : "a vibe for";

  const render = useCallback(async () => {
    const w = 1080;
    const h = 1920;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    // ---- Background ----
    // Lean heavily into the song's palette so each poster is actually
    // colorful — not a black rectangle with a tint. Base is bg_via (the
    // mid tone), washed with accent from three angles.
    ctx.fillStyle = palette.bg_via;
    ctx.fillRect(0, 0, w, h);

    const bandA = ctx.createLinearGradient(0, 0, w, h);
    bandA.addColorStop(0, hexWithAlpha(palette.accent, 0.55));
    bandA.addColorStop(0.5, hexWithAlpha(palette.bg_via, 0));
    bandA.addColorStop(1, hexWithAlpha(palette.bg_to, 0.85));
    ctx.fillStyle = bandA;
    ctx.fillRect(0, 0, w, h);

    const bandB = ctx.createLinearGradient(w, 0, 0, h);
    bandB.addColorStop(0, hexWithAlpha(palette.bg_from, 0.7));
    bandB.addColorStop(0.5, hexWithAlpha(palette.accent, 0));
    bandB.addColorStop(1, hexWithAlpha(palette.accent, 0.35));
    ctx.fillStyle = bandB;
    ctx.fillRect(0, 0, w, h);

    // bloom #1 — strong accent hotspot top-left
    const glow = ctx.createRadialGradient(w * 0.25, h * 0.18, 0, w * 0.25, h * 0.18, w * 1.1);
    glow.addColorStop(0, hexWithAlpha(palette.accent, 0.75));
    glow.addColorStop(0.35, hexWithAlpha(palette.accent, 0.25));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // bloom #2 — cooler bg_from pool bottom-right
    const glow2 = ctx.createRadialGradient(w * 0.85, h * 0.85, 0, w * 0.85, h * 0.85, w * 0.9);
    glow2.addColorStop(0, hexWithAlpha(palette.bg_from, 0.75));
    glow2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, w, h);

    // bloom #3 — secondary accent dot mid-right
    const glow3 = ctx.createRadialGradient(w * 0.9, h * 0.45, 0, w * 0.9, h * 0.45, w * 0.55);
    glow3.addColorStop(0, hexWithAlpha(palette.accent, 0.5));
    glow3.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow3;
    ctx.fillRect(0, 0, w, h);

    drawSwirl(ctx, w, h, palette.accent, hashSeed(vibeName ?? title));

    // grain
    const grain = ctx.createImageData(w, h);
    for (let i = 0; i < grain.data.length; i += 4) {
      const on = Math.random() < 0.015;
      grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = on ? 255 : 0;
      grain.data[i + 3] = on ? 22 : 0;
    }
    ctx.putImageData(grain, 0, 0);

    // ---- Text ----
    const PAD = 90;
    const right = w - PAD;
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";

    // 1. header: "{initials}'s vibe for"
    ctx.font = '600 36px ui-sans-serif, system-ui, sans-serif';
    ctx.globalAlpha = 0.6;
    ctx.fillText(headerLabel.toUpperCase(), PAD, PAD + 50);
    ctx.globalAlpha = 1;

    // 2. huge song title — with a soft accent glow behind so it pops
    ctx.font = '700 110px ui-serif, Georgia, serif';
    ctx.save();
    ctx.shadowColor = hexWithAlpha(palette.accent, 0.55);
    ctx.shadowBlur = 30;
    const titleBottom = wrapText(ctx, title.slice(0, 60), PAD, PAD + 180, right - PAD, 120);
    ctx.restore();

    // 3. cover art — square, centered, ~60% of width
    const coverSize = Math.min(720, w - PAD * 2);
    const coverX = (w - coverSize) / 2;
    const coverY = titleBottom + 40;
    // shadow box + colored gradient frame
    ctx.save();
    ctx.shadowColor = hexWithAlpha(palette.accent, 0.7);
    ctx.shadowBlur = 100;
    ctx.shadowOffsetY = 30;
    roundRect(ctx, coverX, coverY, coverSize, coverSize, 36);
    ctx.fillStyle = palette.bg_via;
    ctx.fill();
    ctx.restore();

    // Outer gradient ring so the cover feels framed, not floating on black
    const frameGrad = ctx.createLinearGradient(coverX, coverY, coverX + coverSize, coverY + coverSize);
    frameGrad.addColorStop(0, palette.accent);
    frameGrad.addColorStop(1, palette.bg_from);
    ctx.save();
    ctx.strokeStyle = frameGrad;
    ctx.lineWidth = 10;
    roundRect(ctx, coverX - 2, coverY - 2, coverSize + 4, coverSize + 4, 38);
    ctx.stroke();
    ctx.restore();
    // image (may be null if not yet loaded)
    if (coverUrl) {
      try {
        const img = await loadImage(`/api/vibes/${vibeId}/cover`);
        ctx.save();
        roundRect(ctx, coverX, coverY, coverSize, coverSize, 36);
        ctx.clip();
        // cover-fit (fill square)
        const ratio = img.width / img.height;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (ratio > 1) {
          sw = img.height;
          sx = (img.width - sw) / 2;
        } else if (ratio < 1) {
          sh = img.width;
          sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, coverX, coverY, coverSize, coverSize);
        ctx.restore();
      } catch {
        /* no image; keep the placeholder fill */
      }
    }

    // 4. vibe name (italic) — below cover
    let y = coverY + coverSize + 80;
    if (vibeName) {
      ctx.font = 'italic 600 56px ui-serif, Georgia, serif';
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = palette.accent;
      y = wrapText(ctx, vibeName.slice(0, 48), PAD, y, right - PAD, 66);
      ctx.fillStyle = palette.text;
      ctx.globalAlpha = 1;
      y += 10;
    }

    // 5. lyric line or setting
    const sample = pickSampleLines(lyrics, 1);
    const tagline = sample[0] ? `"${sample[0]}"` : storyline?.setting ?? "";
    if (tagline) {
      ctx.font = '500 38px ui-serif, Georgia, serif';
      ctx.globalAlpha = 0.8;
      y = wrapText(ctx, tagline.slice(0, 140), PAD, y, right - PAD, 52);
      ctx.globalAlpha = 1;
    }

    // 6. palette swatches near bottom
    const sw = 62;
    const sy = h - 230;
    const colors = [palette.bg_from, palette.bg_via, palette.bg_to, palette.accent, palette.text];
    for (let i = 0; i < colors.length; i++) {
      ctx.fillStyle = colors[i];
      roundRect(ctx, PAD + i * (sw + 14), sy, sw, sw, 14);
      ctx.fill();
    }

    // 7. bottom block: artist + URL
    ctx.fillStyle = palette.text;
    ctx.globalAlpha = 0.7;
    ctx.font = '500 32px ui-sans-serif, system-ui, sans-serif';
    if (artist) ctx.fillText(artist.slice(0, 56), PAD, h - 130);
    ctx.globalAlpha = 1;

    ctx.fillStyle = palette.accent;
    ctx.font = '700 38px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(
      sharePath ? `vibe.dilyor.dev${sharePath}` : "vibe.dilyor.dev",
      PAD,
      h - 80,
    );

    setDataUrl(c.toDataURL("image/png"));
  }, [vibeId, title, vibeName, mood, artist, palette, lyrics, storyline, sharePath, coverUrl, headerLabel]);

  // auto-render once per meaningful change
  useEffect(() => {
    const key = `${vibeId}|${sharePath}|${vibeName}|${title}|${palette.accent}|${coverUrl ?? ""}`;
    if (renderedFor.current === key) return;
    renderedFor.current = key;
    render();
  }, [vibeId, sharePath, vibeName, title, palette.accent, coverUrl, render]);

  const shareToStories = async () => {
    if (!dataUrl || busy) return;
    setBusy(true);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "vibe-story.png", { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
        share?: (d: ShareData) => Promise<void>;
      };
      const shareUrl = sharePath
        ? `https://vibe.dilyor.dev${sharePath}`
        : "https://vibe.dilyor.dev";
      const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);

      const payload: ShareData = {
        files: [file],
        title: `${title} · vibe`,
        text: `${title} — feel it on vibe.dilyor.dev`,
        url: shareUrl,
      };

      // Primary: native share sheet with the PNG attached. On iOS/Android
      // the user picks Instagram and the image drops straight into the
      // Stories editor — this is the flow Spotify uses outside its app.
      if (nav.canShare && nav.canShare(payload) && nav.share) {
        await nav.share(payload);
        setStatus("opening instagram…");
        return;
      }

      // Secondary: save image + copy link. On mobile also punch the user
      // straight into the Instagram Stories camera (image is in their
      // camera roll; one swipe up and they pick it).
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      download();
      if (isMobile) {
        setStatus("saved — opening instagram…");
        // must happen synchronously off the click gesture for iOS Safari
        setTimeout(() => {
          window.location.href = "instagram://story-camera";
        }, 600);
      } else {
        setStatus("saved + link copied — paste into your story");
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      setStatus("couldn't share — saved instead");
      download();
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${(vibeName ?? title).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-story.png`;
    a.click();
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 relative z-20">
      <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em] opacity-60">
        your story
      </p>
      <div
        className="rounded-2xl overflow-hidden bg-black/40 w-full max-w-[280px] sm:max-w-[320px] aspect-[9/16] relative"
        style={{ boxShadow: `0 20px 60px ${palette.accent}35` }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="vibe story preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-2 w-full max-w-[320px]">
        <button
          onClick={shareToStories}
          disabled={!dataUrl || busy}
          className="w-full py-3 rounded-full font-medium text-sm disabled:opacity-50 transition"
          style={{ background: palette.accent, color: "#0b0b10" }}
        >
          {busy ? "sharing…" : "share to your stories"}
        </button>
        <button
          onClick={download}
          disabled={!dataUrl}
          className="text-[11px] uppercase tracking-[0.25em] opacity-60 hover:opacity-100 transition"
        >
          save image
        </button>
        {status && <p className="text-[11px] opacity-70 text-center">{status}</p>}
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function hexWithAlpha(hex: string, a: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(/\s+/);
  let line = "";
  let cy = y;
  for (const w of words) {
    const trial = line ? line + " " + w : w;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line) {
    ctx.fillText(line, x, cy);
    cy += lineHeight;
  }
  return cy;
}

function pickSampleLines(lines: LyricLine[], n: number): string[] {
  if (!lines || lines.length === 0) return [];
  const sorted = [...lines].sort((a, b) => b.text.length - a.text.length);
  return sorted.slice(0, n).map((l) => l.text);
}

function drawSwirl(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  seed: number,
) {
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  const cx = w * 0.82;
  const cy = h * 0.18;
  const rings = 6;
  for (let k = 0; k < rings; k++) {
    ctx.beginPath();
    const radius = 120 + k * 38;
    const wob = 18 + k * 5;
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2 + r() * 0.3;
      const rad = radius + Math.sin(a * 3 + k) * wob;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
