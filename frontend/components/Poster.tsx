"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LyricLine, Palette, Storyline } from "@/lib/types";

/**
 * Instagram-story-shaped poster (1080x1920). Client-side canvas render
 * so the PNG exists locally — can be shared via Web Share API (mobile)
 * or downloaded (desktop). Shows a preview modal first so the user
 * sees the actual artwork before deciding to share.
 */
export default function Poster({
  title,
  vibeName,
  mood,
  artist,
  palette,
  lyrics,
  storyline,
  sharePath,
}: {
  title: string;
  vibeName?: string;
  mood?: string;
  artist?: string;
  palette: Palette;
  lyrics: LyricLine[];
  storyline?: Storyline;
  sharePath?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const render = useCallback(async () => {
    setRendering(true);
    try {
      const w = 1080;
      const h = 1920;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;

      // background gradient (top → bottom for stories feel)
      const grad = ctx.createLinearGradient(0, 0, w * 0.3, h);
      grad.addColorStop(0, palette.bg_from);
      grad.addColorStop(0.5, palette.bg_via);
      grad.addColorStop(1, palette.bg_to);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // glow at the top-left
      const glow = ctx.createRadialGradient(w * 0.3, h * 0.22, 0, w * 0.3, h * 0.22, w * 1.2);
      glow.addColorStop(0, hexWithAlpha(palette.accent, 0.5));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // second glow bottom-right
      const glow2 = ctx.createRadialGradient(w * 0.85, h * 0.8, 0, w * 0.85, h * 0.8, w);
      glow2.addColorStop(0, hexWithAlpha(palette.accent, 0.25));
      glow2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow2;
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

      // tiny label at top
      ctx.font = '600 30px ui-sans-serif, system-ui, sans-serif';
      ctx.globalAlpha = 0.55;
      ctx.fillText(
        (mood ?? "vibe").toUpperCase().split("").join("  ").slice(0, 80),
        PAD,
        PAD + 40,
      );
      ctx.globalAlpha = 1;

      // huge vibe name — takes up the upper third
      const name = (vibeName ?? title).slice(0, 48);
      ctx.font = '600 130px ui-serif, Georgia, serif';
      const bottomOfName = wrapText(ctx, name, PAD, 340, right - PAD, 138);

      // description / tagline
      if (storyline?.setting) {
        ctx.globalAlpha = 0.78;
        ctx.font = 'italic 400 40px ui-serif, Georgia, serif';
        wrapText(ctx, storyline.setting.slice(0, 160), PAD, bottomOfName + 40, right - PAD, 56);
        ctx.globalAlpha = 1;
      }

      // two most-striking lyric lines, centered lower-middle
      const sample = pickSampleLines(lyrics, 2);
      if (sample.length) {
        ctx.font = '500 44px ui-serif, Georgia, serif';
        let y = h * 0.58;
        ctx.globalAlpha = 0.92;
        for (const line of sample) {
          y = wrapText(ctx, `"${line.slice(0, 120)}"`, PAD, y, right - PAD, 58);
          y += 24;
        }
        ctx.globalAlpha = 1;
      }

      // palette swatches bottom
      const sw = 70;
      const sy = h - 240;
      const colors = [palette.bg_from, palette.bg_via, palette.bg_to, palette.accent, palette.text];
      for (let i = 0; i < colors.length; i++) {
        ctx.fillStyle = colors[i];
        roundRect(ctx, PAD + i * (sw + 16), sy, sw, sw, 16);
        ctx.fill();
      }

      // song info + URL — bottom block
      ctx.fillStyle = palette.text;
      ctx.globalAlpha = 0.7;
      ctx.font = '500 34px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(`${title}${artist ? ` — ${artist}` : ""}`.slice(0, 64), PAD, h - 130);
      ctx.globalAlpha = 1;

      ctx.fillStyle = palette.accent;
      ctx.font = '700 38px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(
        sharePath ? `vibe.dilyor.dev${sharePath}` : "vibe.dilyor.dev",
        PAD,
        h - 80,
      );

      setDataUrl(c.toDataURL("image/png"));
    } finally {
      setRendering(false);
    }
  }, [title, vibeName, mood, artist, palette, lyrics, storyline, sharePath]);

  const openPreview = async () => {
    setOpen(true);
    await render();
  };

  return (
    <>
      <button
        onClick={openPreview}
        className="rounded-full px-6 py-3 text-sm border border-white/20 bg-white/10 hover:bg-white/20 transition backdrop-blur"
      >
        preview a poster
      </button>
      {open && (
        <PreviewModal
          dataUrl={dataUrl}
          rendering={rendering}
          onClose={() => setOpen(false)}
          accent={palette.accent}
          title={vibeName ?? title}
          sharePath={sharePath}
        />
      )}
    </>
  );
}

function PreviewModal({
  dataUrl,
  rendering,
  onClose,
  accent,
  title,
  sharePath,
}: {
  dataUrl: string | null;
  rendering: boolean;
  onClose: () => void;
  accent: string;
  title: string;
  sharePath?: string | null;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  // close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-story.png`;
    a.click();
    setStatus("saved to your device");
  };

  const shareToStories = async () => {
    if (!dataUrl) return;
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
      const payload: ShareData = {
        files: [file],
        title: `${title} · vibe`,
        text: `${title} — feel it on vibe.dilyor.dev`,
        url: shareUrl,
      };
      if (nav.canShare && nav.canShare(payload) && nav.share) {
        await nav.share(payload);
        setStatus("shared");
      } else {
        // desktop fallback — copy link, download image
        await navigator.clipboard.writeText(shareUrl).catch(() => {});
        download();
        setStatus("image saved, link copied — paste into your story");
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      setStatus("couldn't share — try save instead");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center p-5 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass rounded-3xl p-5 sm:p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        style={{ color: "#f5f5f7" }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="uppercase text-[10px] tracking-[0.3em] opacity-60">
              story poster
            </p>
            <p className="font-serif text-lg mt-1 tracking-tight">
              {title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="opacity-50 hover:opacity-100 transition text-lg"
            aria-label="close"
          >
            ✕
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden bg-black/40 aspect-[9/16] grid place-items-center mb-4">
          {rendering || !dataUrl ? (
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
          ) : (
            <img
              ref={imgRef}
              src={dataUrl}
              alt="vibe poster preview"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={shareToStories}
            disabled={!dataUrl}
            className="w-full py-3 rounded-xl font-medium disabled:opacity-50"
            style={{ background: accent, color: "#0b0b10" }}
          >
            share to your stories
          </button>
          <button
            onClick={download}
            disabled={!dataUrl}
            className="w-full py-2.5 rounded-xl text-sm border border-white/20 bg-white/5 hover:bg-white/15 transition disabled:opacity-50"
          >
            save image
          </button>
          {status && (
            <p className="text-[11px] opacity-70 text-center mt-1">{status}</p>
          )}
        </div>
      </div>
    </div>
  );
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
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  const cx = w * 0.82;
  const cy = h * 0.22;
  const rings = 7;
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
