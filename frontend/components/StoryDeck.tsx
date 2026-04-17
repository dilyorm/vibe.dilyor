"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LyricLine, Palette, Storyline, VibeListItem } from "@/lib/types";

type SlideKind = "intro" | "vibe" | "scene" | "characters" | "story" | "lyrics" | "outro";

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
}: Props) {
  const story = storyline ?? {};
  const characters = story.characters ?? [];

  const slides = useMemo<Slide[]>(() => {
    const s: Slide[] = [{ kind: "intro", duration: 5 }];
    if (vibeName || description) s.push({ kind: "vibe", duration: 7 });
    if (story.setting) s.push({ kind: "scene", duration: 6 });
    if (characters.length > 0) s.push({ kind: "characters", duration: 7 });
    if (summary || story.arc) s.push({ kind: "story", duration: 9 });
    if (lyrics.length > 0) s.push({ kind: "lyrics", duration: Math.max(20, duration || 30) });
    s.push({ kind: "outro", duration: 0 });
    return s;
  }, [vibeName, description, story.setting, story.arc, characters.length, summary, lyrics.length, duration]);

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
      <Backdrop palette={palette} coverUrl={coverUrl} kind={slide.kind} />

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

      {/* tap zones — left 30% goes back, rest advances (IG-style) */}
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
          similar={similar}
          ratingNode={ratingNode}
          shareNode={shareNode}
        />
      </div>
    </div>
  );
}

function Backdrop({
  palette,
  coverUrl,
  kind,
}: {
  palette: Palette;
  coverUrl?: string | null;
  kind: SlideKind;
}) {
  const showCover = !!coverUrl;
  const blur = kind === "lyrics" ? 40 : 60;

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
            opacity: 0.55,
            transform: "scale(1.2)",
          }}
        />
      )}

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
  similar: VibeListItem[];
  ratingNode: React.ReactNode;
  shareNode: React.ReactNode;
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
    similar,
    ratingNode,
    shareNode,
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
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em] opacity-60 mb-4 sm:mb-5">
            {mood ?? "the vibe"}
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-6xl tracking-tight leading-[1.05]">
            {vibeName}
          </h2>
          {description && (
            <p className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl opacity-90 leading-relaxed font-serif italic">
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
        <div className="flex flex-col items-center text-center max-w-md animate-rise w-full">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.35em] opacity-60 mb-6 sm:mb-8">
            who&apos;s in the song
          </p>
          <ul className="flex flex-col gap-5 sm:gap-6 w-full">
            {(storyline.characters ?? []).map((c, i) => (
              <li
                key={i}
                className="flex flex-col gap-1 animate-rise"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                <span
                  className="font-serif text-xl sm:text-2xl md:text-3xl"
                  style={{ color: accent }}
                >
                  {c.name}
                </span>
                <span className="opacity-75 text-sm md:text-base px-4">{c.role}</span>
              </li>
            ))}
          </ul>
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

          <div className="relative z-20">{shareNode}</div>

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
