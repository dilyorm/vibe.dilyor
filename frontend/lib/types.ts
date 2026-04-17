export interface LyricLine {
  time: number;
  text: string;
}

export interface Palette {
  bg_from: string;
  bg_via: string;
  bg_to: string;
  text: string;
  accent: string;
}

export interface VibeMeta {
  name: string;
  mood: string;
  description: string;
  palette: Palette;
  tempo: "slow" | "mid" | "fast";
  energy?: "low" | "medium" | "high";
  emoji?: string;
  keywords?: string[];
}

export type FigureKind =
  | "narrator"
  | "lover"
  | "crowd"
  | "observer"
  | "dreamer"
  | "wanderer"
  | "ghost"
  | "child";

export interface Character {
  name: string;
  role: string;
  figure?: FigureKind;
}

export interface Storyline {
  setting?: string;
  characters?: Character[];
  arc?: string;
}

export interface Vibe {
  id: string;
  title: string;
  artist?: string;
  language?: string;
  status: "processing" | "ready" | "error";
  error?: string | null;
  lyrics: LyricLine[];
  lyrics_confidence?: number;
  summary?: string;
  storyline?: Storyline;
  reflections?: { text: string; at: number }[];
  share_initials?: string | null;
  share_index?: number | null;
  vibe: VibeMeta | Record<string, never>;
  audio_ext?: string;
  mime_type?: string;
  created_at: number;
  avg_rating?: number;
  num_ratings?: number;
  creator_name?: string | null;
  cover_url?: string | null;
  thumbnail?: string | null;
}

export interface VibeListItem {
  id: string;
  title: string;
  artist?: string;
  vibe: VibeMeta | Record<string, never>;
  status: "processing" | "ready" | "error";
  avg_rating: number;
  num_ratings: number;
  creator_name?: string | null;
  created_at: number;
  cover_url?: string | null;
}

export function hasVibe(v: Vibe["vibe"]): v is VibeMeta {
  return !!v && typeof v === "object" && "palette" in v;
}
