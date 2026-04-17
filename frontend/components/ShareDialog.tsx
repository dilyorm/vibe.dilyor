"use client";

import { useEffect, useState } from "react";
import { shareVibe } from "@/lib/api";

export default function ShareDialog({
  id,
  open,
  initialName,
  initialInitials,
  initialPath,
  onClose,
  accent = "#f5f5f7",
}: {
  id: string;
  open: boolean;
  initialName?: string | null;
  initialInitials?: string | null;
  initialPath?: string | null;
  onClose: () => void;
  accent?: string;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [initials, setInitials] = useState(initialInitials ?? "");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && initialName && initialPath) {
      setName(initialName);
      setInitials(initialInitials ?? "");
      setLink(`${window.location.origin}${initialPath}`);
    }
  }, [open, initialName, initialInitials, initialPath, id]);

  if (!open) return null;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("drop a name first");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await shareVibe(id, trimmed, initials.trim());
      setLink(`${window.location.origin}${r.share_path}`);
      setInitials(r.share_initials);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-5 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
      onClick={onClose}
    >
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-3xl p-7 md:p-8 w-full max-w-md"
        style={{ color: "#f5f5f7" }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="uppercase text-xs tracking-[0.3em] opacity-60">share the vibe</p>
            <h3 className="font-serif text-2xl mt-1 tracking-tight">
              {link ? "here's your link" : "name this vibe"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="opacity-50 hover:opacity-100 transition"
            aria-label="close"
          >
            ✕
          </button>
        </div>

        {!link && (
          <>
            <p className="text-sm opacity-70 mb-4">
              sign the vibe — your initials become the short link.
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              maxLength={60}
              placeholder="your name or handle"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none placeholder:opacity-40"
            />
            <input
              value={initials}
              onChange={(e) =>
                setInitials(e.target.value.replace(/[^A-Za-z0-9]/g, "").toLowerCase().slice(0, 8))
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="initials (optional, auto-filled)"
              className="mt-3 w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none placeholder:opacity-40 lowercase"
            />
            <p className="mt-2 text-[11px] opacity-50">
              your link will look like <span className="opacity-80">vibe.dilyor.dev/{initials || "yourinitials"}/1</span>
            </p>
            {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
            <button
              onClick={submit}
              disabled={busy}
              className="mt-5 w-full py-3 rounded-xl font-medium transition"
              style={{ background: accent, color: "#0b0b10" }}
            >
              {busy ? "saving…" : "get shareable link"}
            </button>
          </>
        )}

        {link && (
          <>
            <p className="text-sm opacity-70 mb-3">
              send this to a friend. they&apos;ll land in the same room.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 px-3 py-3 rounded-xl bg-white/10 border border-white/20 text-sm truncate"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                onClick={copy}
                className="px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap"
                style={{ background: accent, color: "#0b0b10" }}
              >
                {copied ? "copied!" : "copy"}
              </button>
            </div>
            <p className="mt-3 text-xs opacity-60">
              signed as <span className="font-medium">{name}</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
