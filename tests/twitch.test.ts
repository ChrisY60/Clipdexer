import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as connect } from "../app/api/twitch/connect/route";
import { GET as callback } from "../app/api/twitch/callback/route";
import { helix, sessions } from "../lib/twitch";
test("OAuth requests only the chosen role scope, validates state, and keeps tokens server-side", async () => {
  process.env.TWITCH_CLIENT_ID = "test-client";
  process.env.TWITCH_CLIENT_SECRET = "test-secret";
  process.env.APP_URL = "http://localhost:3000";
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/oauth2/token"))
      return Response.json({
        access_token: "private-access-token",
        refresh_token: "private-refresh-token",
        expires_in: 3600,
      });
    if (url.endsWith("/users")) {
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer private-access-token",
      );
      return Response.json({
        data: [{ id: "123", display_name: "Test channel" }],
      });
    }
    throw new Error("Unexpected provider request");
  };
  try {
    for (const role of ["broadcaster", "editor"]) {
      const start = await connect(
        new NextRequest(
          `http://localhost:3000/api/twitch/connect?role=${role}`,
        ),
      );
      const url = new URL(start.headers.get("location")!);
      assert.equal(
        url.searchParams.get("scope"),
        role === "editor" ? "editor:manage:clips" : "channel:manage:clips",
      );
      const state = url.searchParams.get("state")!;
      const response = await callback(
        new NextRequest(
          `http://localhost:3000/api/twitch/callback?state=${state}&code=test-code`,
          { headers: { cookie: `clipdexer_oauth=${state}` } },
        ),
      );
      assert(response.headers.get("location")?.includes("connected=1"));
      const cookie = response.headers.get("set-cookie")!;
      assert(cookie.includes("HttpOnly"));
      assert(!cookie.includes("private-access-token"));
      const id = /clipdexer_session=([^;]+)/.exec(cookie)![1];
      const s = sessions.get(id)!;
      assert.equal(s.role, role);
      s.expires = 0;
      await helix(s, "users");
      assert(s.expires > Date.now());
      const replay = await callback(
        new NextRequest(
          `http://localhost:3000/api/twitch/callback?state=${state}&code=test-code`,
          { headers: { cookie: `clipdexer_oauth=${state}` } },
        ),
      );
      assert(replay.headers.get("location")?.includes("error="));
      sessions.delete(id);
    }
    const invalid = await callback(
      new NextRequest(
        "http://localhost:3000/api/twitch/callback?state=invalid&code=test-code",
      ),
    );
    assert(invalid.headers.get("location")?.includes("error="));
  } finally {
    globalThis.fetch = original;
  }
});
