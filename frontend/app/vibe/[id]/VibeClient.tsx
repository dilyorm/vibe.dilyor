"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import StarRating from "@/components/StarRating";
import StoryDeck from "@/components/StoryDeck";
import ShareDialog from "@/components/ShareDialog";
import { audioUrl, getVibe, rateVibe, saveReflection, similarVibes } from "@/lib/api";
import { createAmp, createRemix, useAudio } from "@/lib/audioAmp";
import { hasVibe, type Palette, type Vibe, type VibeListItem } from "@/lib/types";

const FALLBACK_PALETTE: Palette = {
  bg_from: "#0b0b10",
  bg_via: "#1a1625",
  bg_to: "#0b0b10",
  text: "#f5f5f7",
  accent: "#b794f6",
};

export default function VibeClient({ id }: { id: string }) {
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ratingMsg, setRatingMsg] = useState<string | null>(null);
  const [similar, setSimilar] = useState<VibeListItem[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const ampRef = useRef(createAmp());
  const remixRef = useRef(createRemix());
  const [everPlayed, setEverPlayed] = useState(false);
  useAudio(audioRef, ampRef, remixRef, everPlayed);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const v = await getVibe(id);
      setVibe(v);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "failed to load");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!vibe || vibe.status !== "processing") return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [vibe, load]);

  useEffect(() => {
    if (!vibe || vibe.status !== "ready") return;
    similarVibes(id, 6).then(setSimilar).catch(() => setSimilar([]));
  }, [vibe, id]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    setEverPlayed(true);
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const submitRating = async (n: number) => {
    try {
      const r = await rateVibe(id, n);
      setRatingMsg(`thanks — ${r.avg_rating.toFixed(1)} from ${r.num_ratings}`);
    } catch {
      setRatingMsg("couldn't save rating");
    }
  };

  const submitReflection = useCallback(
    async (text: string) => {
      try {
        await saveReflection(id, text);
      } catch {
        /* silent; user sees nothing is saved */
      }
    },
    [id],
  );

  if (err) {
    return (
      <div className="min-h-[80vh] grid place-items-center px-6 text-center">
        <div>
          <p className="opacity-70 mb-4">this vibe went missing.</p>
          <Link href="/" className="underline underline-offset-4">go home</Link>
        </div>
      </div>
    );
  }

  if (!vibe) {
    return <div className="min-h-[80vh] grid place-items-center opacity-60">loading…</div>;
  }

  if (vibe.status === "processing") {
    return (
      <div
        className="min-h-screen grid place-items-center px-6 text-center"
        style={{
          background: `linear-gradient(135deg, ${FALLBACK_PALETTE.bg_from}, ${FALLBACK_PALETTE.bg_via}, ${FALLBACK_PALETTE.bg_to})`,
        }}
      >
        <div className="animate-float">
          <div className="w-12 h-12 mx-auto mb-8 rounded-full border border-white/20 border-t-white/80 animate-spin" />
          <h1 className="font-serif text-3xl md:text-5xl tracking-tight mb-3">
            listening…
          </h1>
          <p className="opacity-60 max-w-md mx-auto text-sm">
            transcribing the lyrics, reading the mood, picking the colors of the cover.
          </p>
        </div>
      </div>
    );
  }

  if (vibe.status === "error") {
    return (
      <div className="min-h-[80vh] grid place-items-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="font-serif text-3xl mb-3">something got lost in the mix</h1>
          <p className="opacity-70 text-sm mb-6">{vibe.error}</p>
          <Link href="/" className="underline underline-offset-4">try another track</Link>
        </div>
      </div>
    );
  }

  const meta = hasVibe(vibe.vibe) ? vibe.vibe : null;
  const palette = meta?.palette ?? FALLBACK_PALETTE;
  const accent = palette.accent;
  const coverUrl = vibe.cover_url ?? vibe.thumbnail ?? null;

  const ratingNode = (
    <>
      <StarRating onRate={submitRating} accent={accent} />
      <p className="text-[11px] opacity-60 min-h-[1em]">
        {ratingMsg ??
          (vibe.num_ratings
            ? `${vibe.avg_rating?.toFixed(1)} · ${vibe.num_ratings} rated`
            : "be the first")}
      </p>
    </>
  );

  const shareNode = (
    <button
      onClick={() => setShareOpen(true)}
      className="rounded-full px-6 py-3 text-sm border border-white/20 bg-white/10 hover:bg-white/20 transition backdrop-blur"
    >
      share your vibe
    </button>
  );

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl(vibe.id)}
        preload="metadata"
        crossOrigin="anonymous"
        onPlay={() => {
          setPlaying(true);
          setEverPlayed(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
      />

      <StoryDeck
        title={vibe.title}
        artist={vibe.artist}
        vibeName={meta?.name}
        mood={meta?.mood}
        description={meta?.description}
        summary={vibe.summary}
        storyline={vibe.storyline}
        lyrics={vibe.lyrics}
        lyricsConfidence={vibe.lyrics_confidence}
        palette={palette}
        coverUrl={coverUrl}
        audioRef={audioRef}
        playing={playing}
        onTogglePlay={togglePlay}
        time={time}
        duration={duration}
        similar={similar}
        ratingNode={ratingNode}
        shareNode={shareNode}
        ampRef={ampRef}
        remixRef={remixRef}
        onSaveReflection={submitReflection}
        sharePath={
          vibe.share_initials && vibe.share_index
            ? `/${vibe.share_initials}/${vibe.share_index}`
            : null
        }
      />

      <ShareDialog
        id={id}
        open={shareOpen}
        initialName={vibe.creator_name}
        initialInitials={vibe.share_initials}
        initialPath={
          vibe.share_initials && vibe.share_index
            ? `/${vibe.share_initials}/${vibe.share_index}`
            : null
        }
        onClose={() => setShareOpen(false)}
        accent={accent}
      />
    </>
  );
}
