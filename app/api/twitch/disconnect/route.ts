import { NextRequest, NextResponse } from "next/server";
import { sessions } from "@/lib/twitch";
import { checkOrigin, failure } from "@/lib/http";
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    sessions.delete(req.cookies.get("clipdexer_session")?.value || "");
    const res = NextResponse.json({ ok: true });
    res.cookies.delete("clipdexer_session");
    return res;
  } catch (e) {
    return failure(e);
  }
}
