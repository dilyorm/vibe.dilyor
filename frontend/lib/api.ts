import type { Vibe, VibeListItem } from "./types";

const BASE = "/api";

export async function uploadTrack(file: File, titleHint = ""): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("title_hint", titleHint);
  const res = await fetch(`${BASE}/vibes`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function uploadFromUrl(url: string, titleHint = ""): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/vibes/from-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, title_hint: titleHint }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.detail ?? JSON.stringify(data);
  } catch {
    return res.statusText || `http ${res.status}`;
  }
}

export async function getVibe(id: string): Promise<Vibe> {
  const res = await fetch(`${BASE}/vibes/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("not found");
  return res.json();
}

export async function listVibes(): Promise<VibeListItem[]> {
  const res = await fetch(`${BASE}/vibes`, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to list");
  return res.json();
}

export async function similarVibes(id: string, limit = 6): Promise<VibeListItem[]> {
  const res = await fetch(`${BASE}/vibes/${id}/similar?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function rateVibe(id: string, stars: number) {
  const res = await fetch(`${BASE}/vibes/${id}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stars }),
  });
  if (!res.ok) throw new Error("rate failed");
  return res.json() as Promise<{ avg_rating: number; num_ratings: number }>;
}

export function audioUrl(id: string) {
  return `${BASE}/vibes/${id}/audio`;
}

export interface SearchResult {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string | null;
  url: string;
}

export async function searchTracks(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return data.results ?? [];
}
