"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Amp } from "@/lib/audioAmp";

/**
 * Procedural organic blob avatar derived from a character's name.
 * - Shape: 7 control points around a circle, perturbed by a name-seeded hash
 * - State: smoothly morphs between target shapes every ~5s
 * - Reactive: scales + sharpens with audio amplitude (bass = body, high = jitter)
 *
 * Result: each character has a unique-looking presence that breathes with
 * the song. No clipart, no faces — just a felt entity.
 */
export default function CharacterAvatar({
  name,
  color,
  ampRef,
  size = 220,
  intensity = 1,
  drift = false,
}: {
  name: string;
  color: string;
  ampRef?: React.MutableRefObject<Amp>;
  size?: number;
  intensity?: number;
  drift?: boolean;
}) {
  const seed = useMemo(() => hashSeed(name || "vibe"), [name]);
  const pathRef = useRef<SVGPathElement>(null);
  const groupRef = useRef<SVGGElement>(null);

  // pre-build two target shapes; we'll oscillate between them
  const POINTS = 7;
  const baseA = useMemo(() => buildShape(seed, POINTS, 0), [seed]);
  const baseB = useMemo(() => buildShape(seed + 9173, POINTS, 0.35), [seed]);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const step = () => {
      const t = (performance.now() - start) / 1000;
      // morph cycle 0..1..0 over 5s
      const morph = 0.5 - 0.5 * Math.cos((t / 5) * Math.PI * 2);
      const amp = ampRef?.current;
      const bass = amp?.bass ?? 0;
      const high = amp?.high ?? 0;
      const overall = amp?.overall ?? 0;

      // jitter spike from highs — adds texture on percussive moments
      const jitter = high * 0.12 * intensity;

      // build interpolated path
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < POINTS; i++) {
        const angle = (i / POINTS) * Math.PI * 2;
        const ra = baseA[i];
        const rb = baseB[i];
        const r =
          ra * (1 - morph) +
          rb * morph +
          jitter * Math.sin(t * 6 + i * 1.7) +
          bass * 0.06 * intensity;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        pts.push([x, y]);
      }

      const d = smoothClosedPath(pts);
      if (pathRef.current) pathRef.current.setAttribute("d", d);

      if (groupRef.current) {
        const scale = 1 + bass * 0.18 * intensity + overall * 0.05 * intensity;
        const driftX = drift ? Math.sin(t * 0.3 + seed * 0.001) * 6 : 0;
        const driftY = drift ? Math.cos(t * 0.25 + seed * 0.002) * 6 : 0;
        groupRef.current.setAttribute(
          "transform",
          `translate(${driftX} ${driftY}) scale(${scale.toFixed(3)})`,
        );
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [baseA, baseB, ampRef, intensity, drift, seed]);

  const gradId = `g-${seed}`;
  const filterId = `f-${seed}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="-1.4 -1.4 2.8 2.8"
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <radialGradient id={gradId} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="55%" stopColor={color} stopOpacity="0.85" />
          <stop offset="100%" stopColor={color} stopOpacity="0.15" />
        </radialGradient>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.04" />
        </filter>
      </defs>
      <g ref={groupRef}>
        {/* outer aura */}
        <path
          d=""
          ref={pathRef}
          fill={`url(#${gradId})`}
          filter={`url(#${filterId})`}
          opacity={0.92}
        />
      </g>
    </svg>
  );
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/** Mulberry32 PRNG */
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

function buildShape(seed: number, n: number, extra: number): number[] {
  const r = rng(seed);
  const out: number[] = [];
  const baseR = 1.0;
  for (let i = 0; i < n; i++) {
    // each point: base radius + a perturbation in [-0.25..0.25]
    const wob = (r() - 0.5) * 0.5 + (r() - 0.5) * extra;
    out.push(baseR + wob);
  }
  return out;
}

/** Catmull–Rom-ish closed path through control points */
function smoothClosedPath(points: Array<[number, number]>): string {
  const n = points.length;
  const get = (i: number) => points[((i % n) + n) % n];
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);

    if (i === 0) parts.push(`M ${p1[0].toFixed(4)} ${p1[1].toFixed(4)}`);

    // cubic Bezier control points from Catmull-Rom (alpha=0.5)
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    parts.push(
      `C ${c1x.toFixed(4)} ${c1y.toFixed(4)}, ${c2x.toFixed(4)} ${c2y.toFixed(4)}, ${p2[0].toFixed(4)} ${p2[1].toFixed(4)}`,
    );
  }
  parts.push("Z");
  return parts.join(" ");
}
