"use client";

import { useEffect, useState } from "react";
import VibeCard from "@/components/VibeCard";
import { listVibes } from "@/lib/api";
import type { VibeListItem } from "@/lib/types";

export default function LibraryPage() {
  const [vibes, setVibes] = useState<VibeListItem[] | null>(null);

  useEffect(() => {
    listVibes()
      .then(setVibes)
      .catch(() => setVibes([]));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
      <section className="pt-8 md:pt-16 pb-8 sm:pb-10 text-center">
        <p className="uppercase text-[10px] sm:text-xs tracking-[0.3em] opacity-50 mb-3 sm:mb-4">library</p>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-6xl tracking-tight leading-[1.05]">
          every vibe, so far.
        </h1>
        <p className="mt-3 sm:mt-4 opacity-70 text-sm sm:text-base">
          a quiet gallery of songs and the feelings they left behind.
        </p>
      </section>

      {vibes === null ? (
        <div className="text-center opacity-50">loading library…</div>
      ) : vibes.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center opacity-70">
          nothing here yet — be the first to drop a track.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {vibes.map((v) => (
            <VibeCard key={v.id} v={v} />
          ))}
        </div>
      )}
    </div>
  );
}
