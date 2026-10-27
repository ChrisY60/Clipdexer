import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
export type Session = {
  access: string;
  refresh: string;
  expires: number;
  userId: string;
  name: string;
  role: "broadcaster" | "editor";
};
const global = globalThis as typeof globalThis & {
  twitchSessions?: Map<string, Session>;
  oauthStates?: Map<string, { role: Session["role"]; expires: number }>;
};
export const sessions = (global.twitchSessions ||= new Map());
export const states = (global.oauthStates ||= new Map());
export const configured = () =>
  Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
export const redirectUri = () =>
  process.env.TWITCH_REDIRECT_URI ||
  "http://localhost:3000/api/twitch/callback";
export const random = () => randomBytes(32).toString("hex");
export function session(req: NextRequest) {
  return sessions.get(req.cookies.get("clipdexer_session")?.value || "");
}
export async function token(params: Record<string, string>) {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      ...params,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok)
    throw new Error(
      "Twitch authorization expired or was rejected. Connect again.",
    );
  return res.json();
}
export async function helix(s: Session, endpoint: string) {
  if (s.expires < Date.now() + 60000) {
    const t = await token({
      grant_type: "refresh_token",
      refresh_token: s.refresh,
    });
    s.access = t.access_token;
    s.refresh = t.refresh_token;
    s.expires = Date.now() + t.expires_in * 1000;
  }
  const res = await fetch(`https://api.twitch.tv/helix/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${s.access}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
    },
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  if (!res.ok)
    throw new Error(
      res.status === 403
        ? "Twitch denied permission. Verify your broadcaster/editor role."
        : res.status === 404
          ? "This clip or VOD is unavailable or deleted."
          : res.status === 429
            ? "Twitch rate limit reached. Try again shortly."
            : `Twitch returned ${res.status}. Reconnect if your session expired.`,
    );
  return res.json();
}
