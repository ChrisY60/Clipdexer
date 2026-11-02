import { NextRequest } from "next/server";
import { aiConfigured } from "@/lib/ai";
import { configured, session } from "@/lib/twitch";
import { listClips } from "@/lib/store";
import { visibleClips } from "@/lib/library";
import { exampleQueries, readOnly } from "@/lib/demo";
export async function GET(req: NextRequest) {
  const s = session(req);
  return Response.json({
    ai: aiConfigured(),
    twitch: configured() && !readOnly(),
    readOnly: readOnly(),
    examples: exampleQueries(visibleClips(await listClips(), "demo")),
    user: s ? { name: s.name, id: s.userId, role: s.role } : null,
  });
}
