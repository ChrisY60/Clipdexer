import { NextRequest, NextResponse } from "next/server";
import {
  states,
  token,
  helix,
  random,
  sessions,
  redirectUri,
  Session,
} from "@/lib/twitch";
export async function GET(req: NextRequest) {
  const base = process.env.APP_URL || "http://localhost:3000";
  try {
    const state = req.nextUrl.searchParams.get("state") || "";
    const pending = states.get(state);
    states.delete(state);
    if (
      !pending ||
      pending.expires < Date.now() ||
      state !== req.cookies.get("clipdexer_oauth")?.value
    )
      throw new Error("Twitch sign-in expired. Please try again.");
    const code = req.nextUrl.searchParams.get("code");
    if (!code) throw new Error("Twitch connection was cancelled.");
    const t = await token({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    });
    const s: Session = {
      access: t.access_token,
      refresh: t.refresh_token,
      expires: Date.now() + t.expires_in * 1000,
      userId: "",
      name: "",
      role: pending.role,
    };
    const { data } = await helix(s, "users");
    if (!data[0]) throw new Error("Twitch did not return your account.");
    s.userId = data[0].id;
    s.name = data[0].display_name;
    const id = random();
    sessions.set(id, s);
    const res = NextResponse.redirect(new URL("/?connected=1", base));
    res.cookies.set("clipdexer_session", id, {
      httpOnly: true,
      sameSite: "lax",
      secure: base.startsWith("https:"),
      maxAge: 86400,
      path: "/",
    });
    res.cookies.delete("clipdexer_oauth");
    return res;
  } catch (e) {
    const url = new URL("/", base);
    url.searchParams.set(
      "error",
      e instanceof Error ? e.message : "Connection failed",
    );
    return NextResponse.redirect(url);
  }
}
