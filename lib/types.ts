export type Segment = {
  start: number;
  end: number;
  text: string;
  kind: "speech" | "visual";
  embedding?: number[];
};
export type Clip = {
  id: string;
  title: string;
  streamer?: string;
  category?: string;
  date?: string;
  twitchUrl?: string;
  twitchId?: string;
  broadcasterId?: string;
  owner?: string;
  source: "sample" | "upload" | "twitch" | "link";
  status: "ready" | "queued" | "processing" | "needs_config" | "error" | "link";
  stage?: string;
  error?: string;
  file?: string;
  hash?: string;
  duration?: number;
  thumbnail?: string;
  segments: Segment[];
  segmentCount?: number;
  embeddingModel?: string;
  createdAt: string;
};
export type ClipPage = {
  clips: Clip[];
  page: number;
  pages: number;
  total: number;
  counts: { total: number; ready: number; pending: number };
};
export type Match = {
  explanation?: string;
  /** True when at least one clue has no supporting evidence. */
  partial?: boolean;
  clip: Clip;
  score: number;
  confidence: "strong" | "weak";
  timestamp: number;
  evidence: Segment[];
};
export const stamp = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
