"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  searchTracks,
  uploadFromUrl,
  uploadTrack,
  type SearchResult,
} from "@/lib/api";

type Tab = "search" | "file" | "url";

function fmtDuration(sec: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function UploadCard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("search");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  // search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setErr(null);
      setBusy(true);
      setFileName(file.name);
      try {
        const { id } = await uploadTrack(file);
        router.push(`/vibe/${id}`);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "upload failed");
        setBusy(false);
      }
    },
    [router],
  );

  const handleUrl = useCallback(
    async (target?: string) => {
      const trimmed = (target ?? url).trim();
      if (!trimmed) {
        setErr("paste a link first");
        return;
      }
      setErr(null);
      setBusy(true);
      try {
        const { id } = await uploadFromUrl(trimmed);
        router.push(`/vibe/${id}`);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "could not fetch that link");
        setBusy(false);
        setPickingId(null);
      }
    },
    [url, router],
  );

  // debounced search
  useEffect(() => {
    if (tab !== "search") return;
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchTracks(q, ctrl.signal);
        if (!ctrl.signal.aborted) setResults(r);
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === "AbortError") return;
        setErr(e instanceof Error ? e.message : "search failed");
        setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, tab]);

  const pickResult = (r: SearchResult) => {
    setPickingId(r.id);
    handleUrl(r.url);
  };

  return (
    <div
      onDragOver={(e) => {
        if (tab !== "file") return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (tab !== "file") return;
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      className={`glass rounded-3xl p-4 sm:p-6 md:p-10 transition-all ${
        dragging ? "scale-[1.01] border-white/30" : ""
      }`}
    >
      <div className="flex justify-center">
        <div className="inline-flex p-1 rounded-full bg-white/5 border border-white/10 mb-6 sm:mb-7 text-xs sm:text-sm">
          {(
            [
              { id: "search", label: "search" },
              { id: "file", label: "upload" },
              { id: "url", label: "link" },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 sm:px-5 py-2 rounded-full transition ${
                tab === t.id ? "bg-white text-black" : "opacity-70 hover:opacity-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "search" && (
        <div>
          <div className="text-center mb-5">
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
              what song you feeling?
            </h2>
            <p className="text-sm opacity-70 mt-2">
              type any song. pick the right one. we do the rest.
            </p>
          </div>
          <div className="max-w-xl mx-auto relative">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="blinding lights, konsuba ost, mc ride anything…"
              className="w-full px-5 py-4 rounded-full bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none placeholder:opacity-40 text-sm"
              disabled={busy}
            />
            {searching && (
              <span className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            )}
          </div>

          <div className="mt-6 max-w-xl mx-auto flex flex-col gap-2">
            {results && results.length === 0 && !searching && query.trim().length >= 2 && (
              <p className="text-sm opacity-60 text-center py-6">no results. try different words.</p>
            )}
            {results?.map((r) => {
              const picking = pickingId === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => pickResult(r)}
                  disabled={busy}
                  className="group flex items-center gap-4 p-2 pr-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition text-left disabled:opacity-60"
                >
                  <div
                    className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-black/40"
                    style={{
                      backgroundImage: r.thumbnail ? `url(${r.thumbnail})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {picking && (
                      <div className="absolute inset-0 grid place-items-center bg-black/50">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white/90 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-2">{r.title}</div>
                    <div className="text-xs opacity-60 mt-1">
                      {r.channel}
                      {r.duration ? ` · ${fmtDuration(r.duration)}` : ""}
                    </div>
                  </div>
                  <span className="text-xs opacity-50 group-hover:opacity-100">
                    {picking ? "loading…" : "pick →"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-6 text-xs opacity-40 text-center">
            picking streams audio from the source. no account, no upload.
          </p>
        </div>
      )}

      {tab === "file" && (
        <div className="text-center">
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight mb-2">
            drop a track, find its vibe
          </h2>
          <p className="text-sm opacity-70 mb-8 max-w-md mx-auto">
            mp3, wav, m4a, flac — up to 25 MB.
          </p>
          <label className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black text-sm font-medium cursor-pointer hover:bg-white/90 transition">
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {busy ? "uploading…" : "choose a file"}
          </label>
          {fileName && <p className="mt-5 text-xs opacity-60 truncate">{fileName}</p>}
          <p className="mt-8 text-xs opacity-40">or drag &amp; drop anywhere in this card</p>
        </div>
      )}

      {tab === "url" && (
        <div className="text-center">
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight mb-2">
            paste a link
          </h2>
          <p className="text-sm opacity-70 mb-7 max-w-md mx-auto">
            youtube, soundcloud, bandcamp, yandex music. we&apos;ll pull the audio.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUrl()}
              placeholder="https://…"
              disabled={busy}
              className="flex-1 px-4 py-3 rounded-full bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none placeholder:opacity-40 text-sm"
            />
            <button
              onClick={() => handleUrl()}
              disabled={busy}
              className="px-6 py-3 rounded-full bg-white text-black text-sm font-medium disabled:opacity-50 hover:bg-white/90 transition whitespace-nowrap"
            >
              {busy ? "fetching…" : "find vibe"}
            </button>
          </div>
          <p className="mt-6 text-xs opacity-40">
            spotify locks their audio — use any other source.
          </p>
        </div>
      )}

      {err && <p className="mt-5 text-sm text-red-300 text-center">{err}</p>}
    </div>
  );
}
