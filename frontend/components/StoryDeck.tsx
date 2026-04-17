"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CharacterAvatar from "./CharacterAvatar";
import CharacterFigure from "./CharacterFigure";
import Poster from "./Poster";
import type { Amp, RemixState } from "@/lib/audioAmp";
import type { LyricLine, Palette, Storyline, VibeListItem } from "@/lib/types";

type SlideKind = "intro" | "vibe" | "scene" | "characters" | "story" | "lyrics" | "remix" | "outro";

interface Slide {
  kind: SlideKind;
  duration: number; // seconds; lyrics slide overrides with audio duration
}

interface Props {
  title: string;
  artist?: string;
  vibeName?: string;
  mood?: string;
  description?: string;
  summary?: string;
  storyline?: Storyline;
  lyrics: LyricLine[];
  lyricsConfidence?: number;
  palette: Palette;
  coverUrl?: string | null;
  audioRef: React.RefObject<HTMLAudioElement>;
  playing: boolean;
  onTogglePlay: () => void;
  time: number;
  duration: number;
  similar: VibeListItem[];
  ratingNode: React.ReactNode;
  shareNode: React.ReactNode;
  ampRef: React.MutableRefObject<Amp>;
  remixRef: React.MutableRefObject<RemixState>;
  onSaveReflection?: (text: string) => Promise<void>;
  sharePath?: string | null;
  isPrivate?: boolean;
  onTogglePrivacy?: () => Promise<void>;
}

export default function StoryDeck({
  title,
  artist,
  vibeName,
  mood,
  description,
  summary,
  storyline,
  lyrics,
  palette,
  coverUrl,
  audioRef,
  playing,
  onTogglePlay,
  time,
  duration,
  similar,
  ratingNode,
  shareNode,
  ampRef,
  remixRef,
  lyricsConfidence,
  onSaveReflection,
  sharePath,
  isPrivate,
  onTogglePrivacy,
}: Props) {
  const story = storyline ?? {};
  const characters = story.characters ?? [];

  // Build a distinct color per character by hue-shifting palette.accent.
  // Keeps the family of colors coherent but gives each character its own tint.
  const charColors = useMemo(
    () => characters.map((_, i) => shiftHue(palette.accent, (i - (characters.length - 1) / 2) * 35)),
    [characters, palette.accent],
  );

  // Only show lyrics when Gemini was confident. Low-confidence transcriptions
  // were making the lyrics slide read like gibberish for unclear vocals.
  const showLyrics = lyrics.length > 0 && (lyricsConfidence ?? 1) >= 0.55;

  const slides = useMemo<Slide[]>(() => {
    const s: Slide[] = [{ kind: "intro", duration: 5 }];
    if (vibeName || description) s.push({ kind: "vibe", duration: 7 });
    if (story.setting) s.push({ kind: "scene", duration: 6 });
    if (characters.length > 0) s.push({ kind: "characters", duration: 7 });
    if (summary || story.arc) s.push({ kind: "story", duration: 9 });
    if (showLyrics) s.push({ kind: "lyrics", duration: Math.max(20, duration || 30) });
    // Remix slide: only if there's audio (hold-to-filter has no point otherwise)
    if (duration > 0) s.push({ kind: "remix", duration: 14 });
    s.push({ kind: "outro", duration: 0 });
    return s;
  }, [vibeName, description, story.setting, story.arc, characters.length, summary, showLyrics, duration]);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 within current slide

  // Reset progress when slide changes
  useEffect(() => {
    setProgress(0);
  }, [idx]);

  // Auto-start audio on first interaction
  const ensurePlaying = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    }
  }, [audioRef]);

  const advance = useCallback(() => {
    setIdx((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  const back = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  // Auto-advance based on slide duration. Lyrics slide tracks audio time.
  useEffect(() => {
    if (paused) return;
    const slide = slides[idx];
    if (!slide || slide.duration <= 0) return; // outro waits
    const start = performance.now();
    let raf = 0;
    const step = () => {
      const elapsed = (performance.now() - start) / 1000;
      const p = Math.min(1, elapsed / slide.duration);
      setProgress(p);
      if (p >= 1) {
        if (idx < slides.length - 1) {
          setIdx((i) => i + 1);
        }
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [idx, paused, slides]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") advance();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === " ") {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, back, onTogglePlay]);

  const slide = slides[idx];
  const accent = palette.accent;
  const text = palette.text;

  // Tap zones
  const onTapLeft = () => {
    ensurePlaying();
    back();
  };
  const onTapRight = () => {
    ensurePlaying();
    advance();
  };

  const onPressStart = () => setPaused(true);
  const onPressEnd = () => setPaused(false);

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none z-[60]"
      style={{
        color: text,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Backdrop
        palette={palette}
        coverUrl={coverUrl}
        kind={slide.kind}
        characters={characters}
        charColors={charColors}
        vibeSeed={vibeName ?? title}
        ampRef={ampRef}
      />

      {/* progress bars */}
      <div
        className="absolute left-0 right-0 z-20 flex gap-1 px-3 pt-3 pointer-events-none"
        style={{ top: "env(safe-area-inset-top, 0)" }}
      >
        {slides.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-[3px] rounded-full bg-white/15 overflow-hidden"
          >
            <div
              className="h-full bg-white/85"
              style={{
                width:
                  i < idx ? "100%" : i === idx ? `${progress * 100}%` : "0%",
                transition: i === idx ? "none" : "width 0.2s linear",
              }}
            />
          </div>
        ))}
      </div>

      {/* top bar: title + play/pause */}
      <div
        className="absolute left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-5 pointer-events-none"
        style={{ top: "calc(env(safe-area-inset-top, 0) + 22px)" }}
      >
        <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] sm:tracking-[0.3em] opacity-70 truncate max-w-[65%]">
          {title}
          {artist ? ` — ${artist}` : ""}
        </div>
        <button
          onClick={onTogglePlay}
          className="pointer-events-auto w-9 h-9 grid place-items-center rounded-full bg-white/10 backdrop-blur border border-white/15 hover:bg-white/20 active:scale-95 transition"
          aria-label={playing ? "pause" : "play"}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* tap zones — disabled on outro + remix (interactive content there) */}
      {slide.kind !== "outro" && slide.kind !== "remix" && (
        <>
          <button
            aria-label="previous"
            onClick={onTapLeft}
            onMouseDown={onPressStart}
            onMouseUp={onPressEnd}
            onTouchStart={onPressStart}
            onTouchEnd={onPressEnd}
            className="absolute left-0 top-0 bottom-0 w-[30%] z-10"
          />
          <button
            aria-label="next"
            onClick={onTapRight}
            onMouseDown={onPressStart}
            onMouseUp={onPressEnd}
            onTouchStart={onPressStart}
            onTouchEnd={onPressEnd}
            className="absolute right-0 top-0 bottom-0 w-[70%] z-10"
          />
        </>
      )}

      {/* slide content */}
      <div className="absolute inset-0 z-[5] grid place-items-center px-5 sm:px-8 pb-10 pt-20 sm:pt-24 overflow-y-auto">
        <SlideContent
          key={idx}
          slide={slide}
          title={title}
          artist={artist}
          vibeName={vibeName}
          mood={mood}
          description={description}
          summary={summary}
          storyline={story}
          lyrics={lyrics}
          time={time}
          coverUrl={coverUrl}
          accent={accent}
          palette={palette}
          similar={similar}
          ratingNode={ratingNode}
          shareNode={shareNode}
          charColors={charColors}
          ampRef={ampRef}
          remixRef={remixRef}
          onSaveReflection={onSaveReflection}
          sharePath={sharePath}
          isPrivate={isPrivate}
          onTogglePrivacy={onTogglePrivacy}
        />
      </div>
    </div>
  );
}

function Backdrop({
  palette,
  coverUrl,
  kind,
  characters,
  charColors,
  vibeSeed,
  ampRef,
}: {
  palette: Palette;
  coverUrl?: string | null;
  kind: SlideKind;
  characters: { name: string; role: string }[];
  charColors: string[];
  vibeSeed: string;
  ampRef: React.MutableRefObject<Amp>;
}) {
  const showCover = !!coverUrl;
  const blur = kind === "lyrics" ? 40 : 60;

  // Ambient drifting avatars in the deep background — characters' "auras"
  // continue to inhabit the whole experience, not just the characters slide.
  // Hidden on the characters slide itself (focus shifts to foreground avatars).
  const ambient = useMemo(() => {
    const pool = characters.length > 0
      ? characters.map((c, i) => ({ name: c.name, color: charColors[i] }))
      : [{ name: vibeSeed, color: palette.accent }];
    // cap at 2 to keep RAF loops cheap on mobile
    const items = pool.slice(0, 2);
    return items.map((it, i) => {
      const a = (i + 1) * 0.37 + 0.13;
      return {
        ...it,
        x: 15 + ((a * 100) % 70),
        y: 18 + (((a * 1.7) * 100) % 60),
      };
    });
  }, [characters, charColors, vibeSeed, palette.accent]);

  const showAmbient = kind !== "characters" && kind !== "outro";

  return (
    <div className="absolute inset-0 -z-0 overflow-hidden">
      {/* base palette gradient — animated drift */}
      <div
        className="absolute inset-0 animate-gradient-slow"
        style={{
          background: `linear-gradient(135deg, ${palette.bg_from}, ${palette.bg_via} 50%, ${palette.bg_to})`,
          backgroundSize: "300% 300%",
        }}
      />

      {/* blurred cover wash */}
      {showCover && (
        <div
          className="absolute inset-0 transition-all duration-700"
          style={{
            backgroundImage: `url(${coverUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: `blur(${blur}px) saturate(140%)`,
            opacity: 0.5,
            transform: "scale(1.2)",
          }}
        />
      )}

      {/* ambient character auras drifting behind everything */}
      {showAmbient &&
        ambient.map((a, i) => (
          <div
            key={`${a.name}-${i}`}
            className="absolute pointer-events-none"
            style={{
              left: `${a.x}%`,
              top: `${a.y}%`,
              transform: "translate(-50%, -50%)",
              opacity: 0.35,
              filter: "blur(8px)",
              mixBlendMode: "screen",
            }}
          >
            <CharacterAvatar
              name={a.name}
              color={a.color}
              ampRef={ampRef}
              size={260}
              intensity={0.45}
              drift
            />
          </div>
        ))}

      {/* accent glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${palette.accent}33, transparent 60%)`,
        }}
      />

      {/* grain */}
      <div
        className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      {/* darken edges for legibility */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}

function SlideContent(props: {
  slide: Slide;
  title: string;
  artist?: string;
  vibeName?: string;
  mood?: string;
  description?: string;
  summary?: string;
  storyline: Storyline;
  lyrics: LyricLine[];
  time: number;
  coverUrl?: string | null;
  accent: string;
  palette: Palette;
  similar: VibeListItem[];
  ratingNode: React.ReactNode;
  shareNode: React.ReactNode;
  charColors: string[];
  ampRef: React.MutableRefObject<Amp>;
  remixRef: React.MutableRefObject<RemixState>;
  onSaveReflection?: (text: string) => Promise<void>;
  sharePath?: string | null;
  isPrivate?: boolean;
  onTogglePrivacy?: () => Promise<void>;
}) {
  const {
    slide,
    title,
    artist,
    vibeName,
    mood,
    description,
    summary,
    storyline,
    lyrics,
    time,
    coverUrl,
    accent,
    palette,
    similar,
    ratingNode,
    shareNode,
    charColors,
    ampRef,
    remixRef,
    onSaveReflection,
    sharePath,
    isPrivate,
    onTogglePrivacy,
  } = props;

  switch (slide.kind) {
    case "intro":
      return (
        <div className="flex flex-col items-center text-center max-w-md animate-rise">
          {coverUrl && (
            <div
              className="w-44 h-44 sm:w-56 sm:h-56 md:w-72 md:h-72 rounded-2xl shadow-2xl mb-6 sm:mb-8"
              style={{
                backgroundImage: `url(${coverUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: `0 30px 80px ${accent}55`,
              }}
            />
          )}
          <h1 className="font-serif text-2xl sm:text-3xl md:text-5xl tracking-tight leading-tight px-2">
            {title}
          </h1>
          {artist && <p className="mt-3 opacity-80 text-xs sm:text-sm uppercase tracking-[0.25em]">{artist}</p>}
          <p className="mt-8 sm:mt-10 text-[10px] sm:text-[11px] uppercase tracking-[0.35em] opacity-60">
            tap to begin
          </p>
        </div>
      );

    case "vibe":
      return (
        <div className="flex flex-col items-center text-center max-w-xl animate-rise">
          {/* big mood orb representing the song's overall energy */}
          <div className="mb-4 sm:mb-6">
            <CharacterAvatar
              name={vibeName ?? mood ?? "vibe"}
              color={accent}
              ampRef={ampRef}
              size={180}
              intensity={1.4}
            />
          </div>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em] opacity-60 mb-3">
            {mood ?? "the vibe"}
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-6xl tracking-tight leading-[1.05]">
            {vibeName}
          </h2>
          {description && (
            <p className="mt-5 sm:mt-7 text-base sm:text-lg md:text-xl opacity-90 leading-relaxed font-serif italic">
              {description}
            </p>
          )}
        </div>
      );

    case "scene":
      return (
        <div className="flex flex-col items-center text-center max-w-xl animate-rise">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em] opacity-60 mb-5 sm:mb-6">
            the scene
          </p>
          <p className="font-serif text-xl sm:text-2xl md:text-4xl leading-snug italic">
            {storyline.setting}
          </p>
        </div>
      );

    case "characters":
      return (
        <div className="flex flex-col items-center text-center max-w-2xl animate-rise w-full">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em] opacity-60 mb-6 sm:mb-8">
            who&apos;s in the song
          </p>
          <div
            className={`grid gap-4 sm:gap-6 w-full ${
              (storyline.characters ?? []).length === 1
                ? "grid-cols-1"
                : (storyline.characters ?? []).length === 2
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3"
            }`}
          >
            {(storyline.characters ?? []).map((c, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 animate-rise"
                style={{ animationDelay: `${i * 0.18}s` }}
              >
                <CharacterFigure
                  name={c.name}
                  role={c.role}
                  figure={c.figure}
                  color={charColors[i] ?? accent}
                  ampRef={ampRef}
                  size={160}
                />
                <span
                  className="font-serif text-base sm:text-lg md:text-xl mt-1"
                  style={{ color: charColors[i] ?? accent }}
                >
                  {c.name}
                </span>
                <span className="opacity-70 text-xs sm:text-sm leading-snug px-2">
                  {c.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case "story":
      return (
        <div className="flex flex-col items-center text-center max-w-xl animate-rise">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em] opacity-60 mb-5 sm:mb-6">
            what it&apos;s about
          </p>
          {summary && (
            <p className="font-serif text-lg sm:text-xl md:text-2xl leading-relaxed mb-5 sm:mb-6">
              {summary}
            </p>
          )}
          {storyline.arc && (
            <p className="opacity-75 text-sm sm:text-base md:text-lg leading-relaxed">
              {storyline.arc}
            </p>
          )}
        </div>
      );

    case "lyrics":
      return <LyricsSlide lyrics={lyrics} time={time} accent={accent} />;

    case "remix":
      return <RemixSlide remixRef={remixRef} accent={accent} lyrics={lyrics} time={time} />;

    case "outro":
      return (
        <div className="flex flex-col items-center text-center max-w-xl animate-rise gap-7 sm:gap-10 w-full">
          <div>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em] opacity-60 mb-3 sm:mb-4">
              your turn
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-5xl tracking-tight">
              feel it?
            </h2>
          </div>

          <div className="flex flex-col items-center gap-3 relative z-20">
            {ratingNode}
          </div>

          <ReflectionBox
            accent={accent}
            onSave={onSaveReflection}
          />

          <div className="relative z-20 flex flex-wrap items-center justify-center gap-3">
            {shareNode}
            <Poster
              title={title}
              vibeName={vibeName}
              mood={mood}
              artist={artist}
              palette={palette}
              lyrics={lyrics}
              storyline={storyline}
              sharePath={sharePath}
            />
          </div>

          {similar.length > 0 && (
            <div className="w-full relative z-20">
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em] opacity-60 mb-3 sm:mb-4">
                people with your taste also felt
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {similar.slice(0, 6).map((v) => (
                  <a
                    key={v.id}
                    href={`/vibe/${v.id}`}
                    className="aspect-square rounded-xl overflow-hidden block relative group"
                    style={{
                      background:
                        v.cover_url
                          ? undefined
                          : `linear-gradient(135deg, ${accent}55, transparent)`,
                      backgroundImage: v.cover_url ? `url(${v.cover_url})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 text-[10px] leading-tight font-serif text-white/95">
                      {(v.vibe && "name" in v.vibe ? v.vibe.name : null) ?? v.title}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <PrivacyToggle
            isPrivate={isPrivate}
            onToggle={onTogglePrivacy}
            accent={accent}
          />

          <a
            href="/library"
            className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] opacity-60 hover:opacity-100 underline-offset-4 hover:underline relative z-20"
          >
            full library
          </a>
        </div>
      );
  }
}

function PrivacyToggle({
  isPrivate,
  onToggle,
  accent,
}: {
  isPrivate?: boolean;
  onToggle?: () => Promise<void>;
  accent: string;
}) {
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<boolean | undefined>(isPrivate);

  if (!onToggle) return null;

  const current = local ?? isPrivate ?? false;

  const click = async () => {
    if (busy) return;
    setBusy(true);
    // optimistic flip; parent persists + refreshes
    setLocal(!current);
    try {
      await onToggle();
    } catch {
      setLocal(current);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={click}
      disabled={busy}
      className="relative z-20 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] opacity-70 hover:opacity-100 transition"
      style={{ color: current ? accent : undefined }}
    >
      <span
        className="inline-block w-8 h-[18px] rounded-full border transition"
        style={{
          background: current ? "rgba(255,255,255,0.05)" : accent,
          borderColor: current ? `${accent}88` : "transparent",
        }}
      >
        <span
          className="block w-[14px] h-[14px] rounded-full mt-[1px] transition-transform"
          style={{
            background: current ? accent : "#0b0b10",
            transform: current ? "translateX(2px)" : "translateX(16px)",
          }}
        />
      </span>
      {current ? "hidden from library" : "in public library"}
    </button>
  );
}

function RemixSlide({
  remixRef,
  accent,
  lyrics,
  time,
}: {
  remixRef: React.MutableRefObject<RemixState>;
  accent: string;
  lyrics: LyricLine[];
  time: number;
}) {
  const [held, setHeld] = useState(false);

  const onStart = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    remixRef.current.on = true;
    setHeld(true);
  };
  const onEnd = () => {
    remixRef.current.on = false;
    setHeld(false);
  };

  const sorted = useMemo(
    () => [...lyrics].sort((a, b) => a.time - b.time),
    [lyrics],
  );
  const idx = useMemo(() => {
    if (!sorted.length) return -1;
    let i = 0;
    for (let j = 0; j < sorted.length; j++) {
      if (sorted[j].time <= time + 0.2) i = j;
      else break;
    }
    return i;
  }, [sorted, time]);
  const curr = idx >= 0 ? sorted[idx]?.text : "";
  const next = idx + 1 < sorted.length ? sorted[idx + 1]?.text : "";

  return (
    <div className="relative flex flex-col items-center text-center max-w-xl w-full select-none z-30">
      <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em] opacity-60 mb-5">
        a different angle
      </p>

      {/* Full-width press pad. Covers most of the slide so anywhere you put
          your finger counts as a hold. */}
      <button
        type="button"
        onPointerDown={onStart}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onPointerLeave={onEnd}
        onContextMenu={(e) => e.preventDefault()}
        className="relative rounded-3xl w-full py-14 sm:py-20 px-6 transition-all duration-300 block"
        style={{
          background: held ? `${accent}2a` : "rgba(255,255,255,0.04)",
          border: `1px solid ${held ? accent + "80" : "rgba(255,255,255,0.18)"}`,
          transform: held ? "scale(1.02)" : "scale(1)",
          boxShadow: held ? `0 30px 80px ${accent}35` : "none",
          touchAction: "none",
          cursor: held ? "grabbing" : "grab",
        }}
      >
        <p
          className="font-serif leading-snug transition-all duration-300"
          style={{
            color: accent,
            fontStyle: held ? "italic" : "normal",
            fontSize: held ? "2rem" : "1.6rem",
            letterSpacing: held ? "0.02em" : "0",
            opacity: held ? 1 : 0.9,
            filter: held ? "blur(0)" : "blur(0.4px)",
          }}
        >
          {held ? (curr || "underwater") : "press and hold"}
        </p>
        {held && next && (
          <p className="mt-4 font-serif text-lg opacity-60 italic">{next}</p>
        )}
        {!held && (
          <p className="mt-4 text-xs opacity-60 tracking-wide">
            hear the song from further away
          </p>
        )}
      </button>

      {/* Explicit nav — tap zones are disabled on this slide so holds aren't
          stolen by the previous/next regions. */}
      <div className="mt-6 flex items-center gap-4 relative z-40 pointer-events-auto">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }))}
          className="rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.25em] border border-white/15 bg-white/5 hover:bg-white/15 transition"
        >
          ← back
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))}
          className="rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.25em] border border-white/15 bg-white/5 hover:bg-white/15 transition"
        >
          next →
        </button>
      </div>
    </div>
  );
}

function ReflectionBox({
  accent,
  onSave,
}: {
  accent: string;
  onSave?: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!onSave) return null;

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onSave(t);
      setSaved(true);
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md flex flex-col gap-3 relative z-20">
      <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em] opacity-60">
        why does this song hit you?
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        placeholder="a memory, a moment, a feeling…"
        className="w-full min-h-[90px] px-4 py-3 rounded-2xl bg-white/8 border border-white/15 text-sm focus:border-white/40 focus:outline-none placeholder:opacity-40 resize-none"
        disabled={busy || saved}
      />
      {!saved ? (
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          className="self-end rounded-full px-5 py-2 text-xs border border-white/20 bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
          style={{ color: accent }}
        >
          {busy ? "saving…" : "share"}
        </button>
      ) : (
        <p className="text-xs opacity-70 italic self-end">kept. thanks.</p>
      )}
    </div>
  );
}

function shiftHue(hex: string, deg: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  h = (h + deg + 360) % 360;
  // back to RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mLight = l - c / 2;
  let rp = 0, gp = 0, bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + mLight) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
}

function LyricsSlide({
  lyrics,
  time,
  accent,
}: {
  lyrics: LyricLine[];
  time: number;
  accent: string;
}) {
  const sorted = useMemo(
    () => [...lyrics].sort((a, b) => a.time - b.time),
    [lyrics],
  );

  const idx = useMemo(() => {
    if (!sorted.length) return -1;
    let i = 0;
    for (let j = 0; j < sorted.length; j++) {
      if (sorted[j].time <= time + 0.2) i = j;
      else break;
    }
    return i;
  }, [sorted, time]);

  if (sorted.length === 0) {
    return (
      <div className="text-center max-w-md">
        <p className="text-[11px] uppercase tracking-[0.35em] opacity-60 mb-6">
          instrumental
        </p>
        <p className="font-serif text-2xl italic opacity-80">
          no words. just feeling.
        </p>
      </div>
    );
  }

  const prev = idx - 1 >= 0 ? sorted[idx - 1] : null;
  const curr = idx >= 0 ? sorted[idx] : null;
  const next = idx + 1 < sorted.length ? sorted[idx + 1] : null;
  const next2 = idx + 2 < sorted.length ? sorted[idx + 2] : null;

  return (
    <div className="flex flex-col items-center text-center max-w-xl gap-5">
      {prev && (
        <p className="font-serif text-base opacity-30 leading-snug">{prev.text}</p>
      )}
      {curr && (
        <p
          key={idx}
          className="font-serif text-3xl md:text-4xl leading-snug animate-rise"
          style={{ color: accent }}
        >
          {curr.text}
        </p>
      )}
      {next && (
        <p className="font-serif text-lg opacity-50 leading-snug">{next.text}</p>
      )}
      {next2 && (
        <p className="font-serif text-base opacity-25 leading-snug">{next2.text}</p>
      )}
    </div>
  );
}
