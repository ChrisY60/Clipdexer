import { NextRequest, NextResponse } from "next/server";
import { configured, random, states, redirectUri } from "@/lib/twitch";
export async function GET(req: NextRequest) {
  if (!configured())
    return NextResponse.redirect(
      new URL("/?error=Twitch+credentials+are+not+configured", req.url),
    );
  const role =
    req.nextUrl.searchParams.get("role") === "editor"
      ? "editor"
      : "broadcaster";
  const state = random();
  for (const [key, value] of states)
    if (value.expires < Date.now()) states.delete(key);
  states.set(state, { role, expires: Date.now() + 600000 });
  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: role === "editor" ? "editor:manage:clips" : "channel:manage:clips",
    state,
    force_verify: "true",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("clipdexer_oauth", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https:"),
    maxAge: 600,
    path: "/",
  });
  return res;
}
