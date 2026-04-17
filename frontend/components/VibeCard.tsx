import Link from "next/link";
import type { VibeListItem } from "@/lib/types";
import { hasVibe } from "@/lib/types";

export default function VibeCard({ v }: { v: VibeListItem }) {
  const meta = hasVibe(v.vibe) ? v.vibe : null;
  const p = meta?.palette;
  const bg = p
    ? `linear-gradient(135deg, ${p.bg_from}, ${p.bg_via}, ${p.bg_to})`
    : "linear-gradient(135deg, #1a1625, #0b0b10)";
  const textColor = p?.text ?? "#f5f5f7";

  return (
    <Link
      href={`/vibe/${v.id}`}
      className="group relative rounded-3xl overflow-hidden aspect-[4/5] block"
      style={{ background: bg, color: textColor }}
    >
      {v.cover_url && (
        <div
          className="absolute inset-0 opacity-50 group-hover:opacity-70 transition"
          style={{
            backgroundImage: `url(${v.cover_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(2px) saturate(120%)",
          }}
        />
      )}
      <div
        className="absolute inset-0 opacity-90 group-hover:opacity-100 transition"
        style={{
          background: p
            ? `radial-gradient(ellipse at 30% 20%, ${p.accent}55, transparent 60%), linear-gradient(to top, rgba(0,0,0,0.65), transparent 50%)`
            : "linear-gradient(to top, rgba(0,0,0,0.65), transparent 50%)",
        }}
      />
      <div className="relative h-full p-5 flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.25em] opacity-70">
          {meta?.mood ?? v.status}
        </div>

        <div className="mt-auto">
          <div className="font-serif text-xl md:text-2xl leading-tight tracking-tight mb-1 line-clamp-2">
            {meta?.name ?? (v.status === "processing" ? "finding the vibe…" : v.title)}
          </div>
          <div className="text-xs opacity-60 line-clamp-1">
            {v.title}
            {v.artist ? ` · ${v.artist}` : ""}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] opacity-60">
            {v.num_ratings > 0 && <span>{v.avg_rating.toFixed(1)}</span>}
            {v.creator_name && <span className="truncate">{v.creator_name}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
