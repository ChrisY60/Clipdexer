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
  embeddingModel?: string;
  createdAt: string;
};
export type Match = {
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
