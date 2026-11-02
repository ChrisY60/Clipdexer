// Packages the app plus your already-indexed local clips into a folder that
// can be pushed to a Docker host such as a Hugging Face Space.
//
//   node scripts/export-demo.mjs ../clipdexer-space
//
// Only ready, non-Twitch clips are exported, with their playable preview
// (original uploads, audio, and frames stay on your machine). Credentials are
// never copied: .env files are git-ignored and therefore skipped.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.resolve(process.argv[2] || "../clipdexer-space");
if (out === root || out.startsWith(root + path.sep))
  throw new Error("Choose an output folder outside the repository.");
const dataDir = process.env.CLIPDEXER_DATA_DIR || path.join(root, "data");
const target = "/app/demo-data";

mkdirSync(out, { recursive: true });
const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => file && existsSync(file));
for (const file of files) {
  mkdirSync(path.join(out, path.dirname(file)), { recursive: true });
  cpSync(file, path.join(out, file));
}

const clips = JSON.parse(readFileSync(path.join(dataDir, "clips.json"), "utf8"))
  .filter((clip) => clip.status === "ready" && clip.source !== "twitch")
  .filter((clip) =>
    existsSync(path.join(dataDir, "media", clip.id, "preview.mp4")),
  );
mkdirSync(path.join(out, "demo-data", "media"), { recursive: true });
let bytes = 0;
for (const clip of clips) {
  const from = path.join(dataDir, "media", clip.id, "preview.mp4");
  const to = path.join(out, "demo-data", "media", clip.id, "preview.mp4");
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to);
  bytes += readFileSync(from).length;
  clip.file = `${target}/media/${clip.id}/preview.mp4`;
  delete clip.owner;
}
writeFileSync(path.join(out, "demo-data", "clips.json"), JSON.stringify(clips));

// Hugging Face reads Space settings from the README front matter.
const readme = readFileSync("README.md", "utf8");
writeFileSync(
  path.join(out, "README.md"),
  `---
title: Clipdexer
emoji: 🎬
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
short_description: Find the exact moment in your Twitch clips
---

${readme}`,
);
writeFileSync(
  path.join(out, ".gitattributes"),
  "*.mp4 filter=lfs diff=lfs merge=lfs -text\n",
);
console.log(
  `Exported ${files.length} app files and ${clips.length} clips (${(bytes / 1e6).toFixed(1)} MB of video) to ${out}`,
);
