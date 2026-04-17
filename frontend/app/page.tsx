"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import UploadCard from "@/components/UploadCard";
import VibeCard from "@/components/VibeCard";
import { listVibes } from "@/lib/api";
import type { VibeListItem } from "@/lib/types";

export default function HomePage() {
  const [recent, setRecent] = useState<VibeListItem[]>([]);

  useEffect(() => {
    listVibes()
      .then((all) => setRecent(all.slice(0, 6)))
      .catch(() => setRecent([]));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
      <section className="pt-8 md:pt-20 pb-10 md:pb-20 text-center">
        <p className="uppercase text-[10px] sm:text-xs tracking-[0.3em] opacity-50 mb-3 sm:mb-4">
          music · mood · palette
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl tracking-tight leading-[1.05]">
          every song has a <em className="not-italic opacity-70">vibe</em>.
        </h1>
        <p className="mt-4 sm:mt-5 max-w-xl mx-auto opacity-75 text-sm sm:text-base px-2">
          upload a track. we listen, transcribe the lyrics, and paint the room
          in the colors of its feeling.
        </p>
      </section>

      <UploadCard />

      {recent.length > 0 && (
        <section className="mt-20">
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-serif text-2xl md:text-3xl tracking-tight">
              what others felt
            </h2>
            <Link
              href="/library"
              className="text-sm opacity-70 hover:opacity-100 underline-offset-4 hover:underline"
            >
              see library →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {recent.map((v) => (
              <VibeCard key={v.id} v={v} />
            ))}
          </div>
        </section>
      )}

      <footer className="mt-24 pt-8 border-t border-white/10 text-xs opacity-50 text-center">
        built with care · drop a track and see what comes back
      </footer>
    </div>
  );
}
