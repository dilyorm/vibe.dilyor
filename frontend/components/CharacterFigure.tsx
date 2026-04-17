"use client";

import { useEffect, useRef } from "react";
import type { Amp } from "@/lib/audioAmp";
import type { FigureKind } from "@/lib/types";
import CharacterAvatar from "./CharacterAvatar";

/**
 * A character-archetype silhouette drawn in front of the procedural
 * blob aura. One stylised human shape per `figure` kind — abstract, not
 * clipart. The silhouette + aura together give each character a visible
 * identity beyond a name tag.
 */
export default function CharacterFigure({
  name,
  role,
  figure,
  color,
  ampRef,
  size = 160,
  drift = true,
}: {
  name: string;
  role: string;
  figure?: FigureKind;
  color: string;
  ampRef?: React.MutableRefObject<Amp>;
  size?: number;
  drift?: boolean;
}) {
  const figureKind = figure ?? inferFigure(role + " " + name);

  const bodyRef = useRef<SVGGElement>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = () => {
      const t = (performance.now() - start) / 1000;
      const amp = ampRef?.current;
      const overall = amp?.overall ?? 0;
      const bass = amp?.bass ?? 0;
      if (bodyRef.current) {
        const breathe = 1 + Math.sin(t * 1.2) * 0.015 + bass * 0.06;
        bodyRef.current.setAttribute(
          "transform",
          `translate(0 ${(-overall * 1.5).toFixed(2)}) scale(${breathe.toFixed(3)})`,
        );
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ampRef]);

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      {/* aura behind */}
      <div className="absolute inset-0 grid place-items-center opacity-70">
        <CharacterAvatar
          name={name}
          color={color}
          ampRef={ampRef}
          size={size}
          intensity={0.9}
          drift={drift}
        />
      </div>
      {/* silhouette in front */}
      <svg
        viewBox="-50 -60 100 120"
        width={size * 0.7}
        height={size * 0.84}
        className="relative"
        style={{ overflow: "visible" }}
        aria-hidden
      >
        <defs>
          <linearGradient id={`stroke-${figureKind}-${name}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <g
          ref={bodyRef}
          fill="none"
          stroke={`url(#stroke-${figureKind}-${name})`}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <FigurePath kind={figureKind} />
        </g>
      </svg>
    </div>
  );
}

function FigurePath({ kind }: { kind: FigureKind }) {
  switch (kind) {
    case "lover":
      // two heads close, shoulders touching
      return (
        <>
          <circle cx="-10" cy="-36" r="9" />
          <circle cx="14" cy="-36" r="9" />
          <path d="M -22 -20 Q -10 -8 2 -14 Q 14 -8 26 -20" />
          <path d="M -24 -12 Q -4 10 -8 48" />
          <path d="M 26 -12 Q 6 10 10 48" />
        </>
      );
    case "crowd":
      // three heads at staggered heights
      return (
        <>
          <circle cx="-22" cy="-32" r="6" />
          <circle cx="0" cy="-38" r="7" />
          <circle cx="22" cy="-30" r="6" />
          <path d="M -32 -18 L -12 -18" />
          <path d="M -10 -24 L 10 -24" />
          <path d="M 12 -16 L 32 -16" />
          <path d="M -26 -8 Q 0 10 26 -8" />
          <path d="M -20 0 L -20 46" />
          <path d="M 0 4 L 0 50" />
          <path d="M 20 2 L 20 46" />
        </>
      );
    case "observer":
      // seated, arms crossed-ish
      return (
        <>
          <circle cx="0" cy="-36" r="9" />
          <path d="M -18 -18 Q 0 -8 18 -18" />
          <path d="M -16 -12 L -22 22" />
          <path d="M 16 -12 L 22 22" />
          <path d="M -22 22 L 22 22" />
          <path d="M -18 22 L -18 46" />
          <path d="M 18 22 L 18 46" />
        </>
      );
    case "dreamer":
      // reclining, head tilted back
      return (
        <>
          <circle cx="-26" cy="-8" r="9" />
          <path d="M -18 -2 Q 0 4 26 -4" />
          <path d="M -16 2 Q 4 14 34 6" />
          <path d="M -14 14 Q 8 20 34 14" />
          <path d="M -16 -6 Q -24 16 -26 40" />
        </>
      );
    case "wanderer":
      // mid-stride, arm extended
      return (
        <>
          <circle cx="-4" cy="-38" r="8" />
          <path d="M -12 -22 Q 0 -10 8 -24" />
          <path d="M -14 -10 Q -22 14 -26 40" />
          <path d="M 8 -12 L 22 6" />
          <path d="M -4 -8 Q 6 16 -4 48" />
          <path d="M -4 -8 Q 2 22 18 50" />
        </>
      );
    case "ghost":
      // wispy trailing-off figure
      return (
        <>
          <circle cx="0" cy="-32" r="9" />
          <path d="M -16 -18 Q 0 -6 16 -18" />
          <path d="M -18 -10 Q -8 30 -18 50" />
          <path d="M 18 -10 Q 8 30 18 50" />
          <path d="M -20 50 Q -8 46 0 52 Q 8 46 20 50" strokeDasharray="3 3" />
        </>
      );
    case "child":
      // smaller, round, hands at side
      return (
        <>
          <circle cx="0" cy="-30" r="10" />
          <path d="M -14 -14 Q 0 -6 14 -14" />
          <path d="M -12 -8 Q -20 12 -16 34" />
          <path d="M 12 -8 Q 20 12 16 34" />
          <path d="M -10 -6 L -10 36" />
          <path d="M 10 -6 L 10 36" />
        </>
      );
    case "narrator":
    default:
      // centred standing figure, hand toward chest
      return (
        <>
          <circle cx="0" cy="-38" r="9" />
          <path d="M -18 -20 Q 0 -10 18 -20" />
          <path d="M -16 -14 Q -22 14 -20 44" />
          <path d="M 16 -14 Q 20 0 2 4" />
          <path d="M -4 -4 L -4 48" />
          <path d="M 4 -4 L 4 48" />
        </>
      );
  }
}

/** Fallback inference when Gemini omits `figure` — keyword match on role text. */
function inferFigure(s: string): FigureKind {
  const t = s.toLowerCase();
  if (/(lover|romance|romantic|crush|her|him|partner|kiss)/.test(t)) return "lover";
  if (/(crowd|group|society|people|everyone|they)/.test(t)) return "crowd";
  if (/(watch|observ|witness|onlooker|see)/.test(t)) return "observer";
  if (/(dream|imagin|fantas|sleep)/.test(t)) return "dreamer";
  if (/(travel|wander|road|journey|move)/.test(t)) return "wanderer";
  if (/(ghost|memory|absent|gone|remember|past)/.test(t)) return "ghost";
  if (/(child|young|kid|youth|innocen)/.test(t)) return "child";
  return "narrator";
}
