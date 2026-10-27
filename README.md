# Clipdexer

A local-first hackathon app for finding a remembered moment using speech, visual descriptions, and timestamped evidence. Built with Next.js, React, TypeScript, and FFmpeg.

## Run locally

Requirements: Node.js 22.9+ and FFmpeg/FFprobe available on your PATH.

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. No credentials are required for the demo. The server binds to loopback; this is a single-user local app, not a multi-tenant hosting configuration.

For a production build on your machine:

```sh
npm run build
npm start
```

## Try the demo

- Click **Purple shirt, talking about Bulgaria** to combine visual and speech evidence.
- Open a result and click an evidence timestamp to seek the local player.
- Search an unrelated phrase to see **No confident match**. Partial matches are labeled **Weak match**.
- **Add clips** accepts MP4, WebM, MOV, and MKV, up to 100 MB and 180 seconds.
- Without AI credentials, uploads are saved as **needs configuration**, never falsely indexed. Configure AI, restart, and use **Processing → Retry indexing**.
- A Twitch clip URL alone is a saved link, not an indexed video.

The three included videos are original illustrated **sample storyboards**, with authored index data and synthetic on-screen captions. They are not actual streamer clips, speech recordings, or real AI results. Samples have no invented Twitch URLs or streamer identities. Their data lives in `lib/samples.ts`, media in `public/samples/`, and their reproducible generator in `scripts/make-samples.mjs`. Replace the manifest and media together to use your own examples.

## Enable real AI indexing

Copy `.env.example` to `.env.local`, set `OPENAI_API_KEY`, and restart. Uploads send extracted audio and sampled images to the configured providers. Search sends only the query for embedding; it does not send or process videos again.

| Setting                       | Purpose                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `OPENAI_API_KEY`              | Vision and embeddings credential; also default transcription credential       |
| `AI_BASE_URL`                 | OpenAI-compatible chat and embedding API, default `https://api.openai.com/v1` |
| `VISION_MODEL`                | Default `gpt-4o-mini`                                                         |
| `EMBEDDING_MODEL`             | Default `text-embedding-3-small`                                              |
| `TRANSCRIPTION_BASE_URL`      | Separate OpenAI-compatible transcription API                                  |
| `TRANSCRIPTION_API_KEY`       | Optional separate transcription credential                                    |
| `TRANSCRIPTION_MODEL`         | Default `whisper-1`; must return `verbose_json` with timed `segments`         |
| `FFMPEG_PATH`, `FFPROBE_PATH` | Executable paths when not on PATH                                             |
| `CLIPDEXER_DATA_DIR`          | Optional absolute local storage directory                                     |

The transcription adapter validates segment timestamps instead of estimating timestamps from untimed text. Providers/models with different response schemas need a new adapter in `lib/ai.ts`. The default Whisper adapter uses the documented segment-timestamp contract; check provider availability before a future deployment.

Pipeline: validate video → create playable H.264/AAC preview → extract mono audio → transcribe timestamped segments → sample an actual frame at 0, 6, 12… seconds → describe clothing, objects, actions and context without identifying people → embed descriptions and transcripts → persist the index. Silent videos still receive visual indexing. Visual evidence refers to sampled instants, not guarantees about the interval between frames.

Local SHA-256 deduplication prevents uploading the same video twice. Saved speech/frame descriptions are reused on retry. Queued work resumes when the app is opened after restart. Failed provider calls remain visible and can be retried. One job runs at a time; leave the server running during processing.

## Connect Twitch

1. Register an application at [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Register **http://localhost:3000/api/twitch/callback** as the OAuth redirect URI.
3. Set `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, and `TWITCH_REDIRECT_URI` in `.env.local`. Keep `APP_URL=http://localhost:3000` consistent with the URL you use.
4. Restart, open **Connect your Twitch**, and select broadcaster or editor.
5. Broadcasters request only `channel:manage:clips`. Editors request only `editor:manage:clips`; enter the numeric broadcaster ID of a channel you edit.
6. Browse 12 clips per page and import a small selection. Imports fetch official metadata, request an authorized download URL, save the actual video, and queue indexing if AI is configured.

Uses Twitch's [Get Clips and Get Clips Download APIs](https://dev.twitch.tv/docs/api/reference/#get-clips-download), OAuth authorization-code flow with state validation, server-side token refresh, and the [official embedded clip player](https://dev.twitch.tv/docs/embed/video-and-clips/). Twitch currently requires its manage-clips scope even for authorized clip downloads. Clipdexer does not create, edit, or delete Twitch clips. No scraping or third-party downloading tools are used.

The downloaded local preview supports precise timestamp seeking; the official Twitch embed is an alternative. Deleted clips, expired downloads, missing source VODs, permission denials, and rate limits are surfaced. A missing source VOD does not prevent using an available authorized clip file. Tokens stay in server memory behind an opaque HttpOnly cookie; restart requires reconnecting. Imported indexes persist and are visible only to the matching Twitch user in Twitch mode. Demo uploads and samples remain a separate collection.

## Architecture and limits

- `lib/pipeline.ts`: single-process background worker and media processing.
- `lib/ai.ts`: configurable provider adapters.
- `lib/search.ts`: normalized exact-term matching + cosine semantic similarity across content; supports speech and visual evidence from the same clip. Model-mismatched vectors are ignored.
- `lib/store.ts`: atomically replaced JSON records under ignored `data/`, serialized writes. Appropriate for a small local collection, not concurrent server replicas.
- `lib/twitch.ts`: OAuth sessions and official API client.
- `app/api/`: ingestion, search, private range-capable media delivery, and Twitch endpoints.

Confidence labels are retrieval heuristics, not probability estimates. Semantic-only results are conservatively labeled weak; evidence is quoted directly from the saved index, never generated at query time. Sample search is keyword-only without embeddings. An AI outage falls back to keyword search. If you change embedding models, existing vectors are not silently mixed with new query vectors.

This app does not continuously sync channels. It does not yet provide production user accounts, a distributed queue, encrypted-at-rest storage, upload streaming, or a database vector index. Demo/local uploads are shared within this single-machine workspace. Keep the default loopback binding. Files are stored on disk until you remove the local `data/` directory; do not commit it.

## Validation

```sh
npm run check
npm test
npm run build
```

Tests cover combined evidence, weak/no matches, exclusion of unprocessed videos, vector-model compatibility, safe Twitch URLs, OAuth state/scopes/token refresh, and real FFmpeg ingestion against a deterministic **test-only provider stub**. The stub is used only by tests and never supplies app/demo upload results. Live AI and Twitch verification requires your own configured accounts.

With a local dev server running and AI credentials disabled, `npm run test:browser` checks search, timestamp seeking, sample playback, local upload behavior, byte-range delivery, authorization errors, and mobile layout. It removes only its own uniquely named upload fixture afterward.

To regenerate sample assets (requires Chromium installed via `npx playwright install chromium`):

```sh
node scripts/make-samples.mjs
```

API implementation references: [timestamped transcription](https://developers.openai.com/api/docs/guides/speech-to-text) and [vision inputs](https://developers.openai.com/api/docs/guides/images-vision?api-mode=chat).
