import { NextRequest } from "next/server";
export function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const expected = new URL(process.env.APP_URL || "http://localhost:3000");
  // Behind a hosting proxy the public host arrives in x-forwarded-host.
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host"))
    ?.split(",")[0]
    .trim();
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {}
  if (
    origin !== expected.origin &&
    origin !== `http://127.0.0.1:${expected.port || "3000"}` &&
    !(host && originHost === host)
  )
    throw new Error("Request origin is not allowed.");
}
export function twitchUrl(input: string) {
  const u = new URL(input);
  if (
    u.protocol !== "https:" ||
    !["www.twitch.tv", "twitch.tv", "clips.twitch.tv"].includes(u.hostname) ||
    !(u.hostname === "clips.twitch.tv"
      ? /^\/[\w-]+\/?$/.test(u.pathname)
      : /^\/[\w]+\/clip\/[\w-]+\/?$/.test(u.pathname))
  )
    throw new Error("Enter a valid HTTPS Twitch clip URL.");
  return u.origin + u.pathname;
}
export function failure(e: unknown, status = 400) {
  return Response.json(
    { error: e instanceof Error ? e.message : "Request failed" },
    { status },
  );
}
