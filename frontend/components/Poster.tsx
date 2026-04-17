"use client";

import { useState } from "react";
import type { LyricLine, Palette, Storyline } from "@/lib/types";

/**
 * Square poster export. Canvas-based so everything stays client-side —
 * no server render pipeline, no CORS dance with the cover image.
 *
 * Output: 1080x1080 PNG with palette gradient, vibe name, 1-2 lyric lines,
 * and a subtle procedural swirl seeded from the vibe name so every poster
 * looks different. Clean enough to post to Instagram stories directly.
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
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const size = 1080;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      if (!ctx) return;

      // gradient background
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, palette.bg_from);
      grad.addColorStop(0.5, palette.bg_via);
      grad.addColorStop(1, palette.bg_to);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // accent glow
      const glow = ctx.createRadialGradient(size * 0.3, size * 0.3, 0, size * 0.3, size * 0.3, size * 0.9);
      glow.addColorStop(0, hexWithAlpha(palette.accent, 0.45));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // procedural swirl seeded from vibe name
      drawSwirl(ctx, size, palette.accent, hashSeed(vibeName ?? title));

      // grain
      const grain = ctx.createImageData(size, size);
      for (let i = 0; i < grain.data.length; i += 4) {
        const v = Math.random() < 0.015 ? 255 : 0;
        grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = v;
        grain.data[i + 3] = v ? 18 : 0;
      }
      ctx.putImageData(grain, 0, 0);

      // text
      ctx.fillStyle = palette.text;
      ctx.textAlign = "left";

      // top small label
      ctx.font = '600 24px ui-sans-serif, system-ui, sans-serif';
      ctx.globalAlpha = 0.55;
      ctx.fillText((mood ?? "vibe").toUpperCase().split("").join(" "), 80, 130);
      ctx.globalAlpha = 1;

      // vibe name huge
      const name = (vibeName ?? title).slice(0, 40);
      ctx.font = '600 96px ui-serif, Georgia, serif';
      wrapText(ctx, name, 80, 260, size - 160, 104);

      // song info
      ctx.font = '400 28px ui-sans-serif, system-ui, sans-serif';
      ctx.globalAlpha = 0.75;
      ctx.fillText(
        `${title}${artist ? ` · ${artist}` : ""}`.slice(0, 60),
        80,
        size - 260,
      );
      ctx.globalAlpha = 1;

      // two most-emotional lyric lines — pick the two longest for character
      const sample = pickSampleLines(lyrics, 2);
      ctx.font = 'italic 400 34px ui-serif, Georgia, serif';
      ctx.globalAlpha = 0.9;
      let y = size - 200;
      for (const line of sample) {
        const wrapped = wrapText(ctx, `"${line}"`, 80, y, size - 160, 46, true);
        y = wrapped + 14;
      }
      ctx.globalAlpha = 1;

      // bottom: setting + share URL
      ctx.font = '500 22px ui-sans-serif, system-ui, sans-serif';
      ctx.globalAlpha = 0.6;
      if (storyline?.setting) {
        ctx.fillText(storyline.setting.slice(0, 56), 80, size - 120);
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = palette.accent;
      ctx.fillText(
        sharePath ? `vibe.dilyor.dev${sharePath}` : "vibe.dilyor.dev",
        80,
        size - 80,
      );
      ctx.globalAlpha = 1;

      // palette swatches bottom-right
      const sw = 38;
      const sx = size - 80 - sw * 5 - 8 * 4;
      const sy = size - 100;
      const colors = [palette.bg_from, palette.bg_via, palette.bg_to, palette.accent, palette.text];
      for (let i = 0; i < colors.length; i++) {
        ctx.fillStyle = colors[i];
        roundRect(ctx, sx + i * (sw + 8), sy, sw, sw, 10);
        ctx.fill();
      }

      // download
      const dataUrl = c.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${(vibeName ?? title).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-vibe.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={download}
      disabled={busy}
      className="rounded-full px-6 py-3 text-sm border border-white/20 bg-white/10 hover:bg-white/20 transition backdrop-blur"
    >
      {busy ? "rendering…" : "save a poster"}
    </button>
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
  italic = false,
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
  size: number,
  color: string,
  seed: number,
) {
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  const cx = size * 0.72;
  const cy = size * 0.32;
  const rings = 6;
  for (let k = 0; k < rings; k++) {
    ctx.beginPath();
    const radius = 90 + k * 28;
    const wob = 14 + k * 4;
    const steps = 80;
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
