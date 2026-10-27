import { NextRequest } from "next/server";
import { aiConfigured } from "@/lib/ai";
import { configured, session } from "@/lib/twitch";
export async function GET(req: NextRequest) {
  const s = session(req);
  return Response.json({
    ai: aiConfigured(),
    twitch: configured(),
    user: s ? { name: s.name, id: s.userId, role: s.role } : null,
  });
}
