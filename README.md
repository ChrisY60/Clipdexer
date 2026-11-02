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

- Enter a description in the search field, then select **Find the moment**.
- Open a result and click an evidence timestamp to seek the local player.
- Search an unrelated phrase to see **No confident match**. Partial matches are labeled **Weak match**.
- **Add clips** accepts MP4, WebM, MOV, and MKV, up to 100 MB and 180 seconds.
- Without AI credentials, uploads are saved as **needs configuration**, never falsely indexed. Configure AI, restart, and use **Processing → Retry indexing**.
- A Twitch clip URL alone is a saved link, not an indexed video.

No built-in clips are added to the app. Your local collection starts with your own uploads and saved links. Former sample media and authored indexes are retained only as private automated-test fixtures under `tests/fixtures/`; they are not served by the app or included in search.

## Searching with clues

Search separates explicit visual clues (`wearing`, `holding`) from speech clues (`talking about`, `says`, `mentions`). Nearby evidence within a 12-second window ranks higher when it supports every clue. Partial and semantic-only matches remain labeled weak, with an explanation of unconfirmed clues.

Quoted text is a flexible search hint. An exact phrase gets a small ranking boost, but related wording and semantic matches are still allowed. Add exclusions with `not`, `without`, or `excluding`, such as `laughing, not the gaming clip`. Exclusions check saved content and category/title metadata; positive matches still require clip content. Quote literal speech containing words such as `not` so it is not read as an exclusion. Exclusions are based on saved text, not a guarantee that an unrecorded detail is absent.

If no footage evidence matches, a clip whose title or streamer contains every search word is still offered last, labeled as a title match with no evidence. Common word forms and a small set of related terms work without AI. With AI configured, positive clues are embedded separately in one request and compared only against their requested evidence type. Existing clip indexes are reused. Intent parsing uses English cue rules rather than a general-purpose language model; ambiguous wording may need a more explicit query.

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

The downloaded local preview supports precise timestamp seeking; the official Twitch embed is an alternative. Deleted clips, expired downloads, missing source VODs, permission denials, and rate limits are surfaced. A missing source VOD does not prevent using an available authorized clip file. Tokens stay in server memory behind an opaque HttpOnly cookie; restart requires reconnecting. Imported indexes persist and are visible only to the matching Twitch user in Twitch mode. Local uploads remain a separate collection.

## Hosted read-only demo

The home page offers one-click example searches. They are computed from the current collection and shown only when they produce a strong keyword match, so they never cost an AI request.

Set `CLIPDEXER_READ_ONLY=1` to publish an already-indexed collection: search and playback work, while uploads, re-indexing, deletion, and Twitch imports are disabled and hidden. With `OPENAI_API_KEY` set, only search queries are embedded. Optionally set `CLIPDEXER_EXAMPLES` to pipe-separated example queries to try first.

To publish your local clips to a free Hugging Face Space (Docker):

```sh
node scripts/export-demo.mjs ../clipdexer-space   # app + ready clips' previews, no .env files
hf auth login
hf repos create <username>/clipdexer --type space --sdk docker --public   -e CLIPDEXER_READ_ONLY=1 --secrets OPENAI_API_KEY   # key read from your shell env
hf upload <username>/clipdexer ../clipdexer-space . --repo-type space
```

Without `OPENAI_API_KEY` the demo still works with keyword search. The included `Dockerfile` serves on port 7860 and also works on other Docker hosts.

## Library and navigation

The Botanical interface includes an About page at `/about`, keyboard navigation, and responsive layouts. The library returns 12 lightweight clip summaries per page. Filters run on the server; full index evidence loads when a clip is opened. Visible video cards load previews lazily. Background refreshes run only while clips are queued or processing.

Storage remains a local JSON file, which the server reads to build each page. Pagination bounds browser payloads and rendering; it is not a database migration.

## Architecture and limits

- `lib/pipeline.ts`: single-process background worker and media processing.
- `lib/ai.ts`: configurable provider adapters.
- `lib/search.ts`: normalized exact-term matching + cosine semantic similarity across content; supports speech and visual evidence from the same clip. Model-mismatched vectors are ignored.
- `lib/store.ts`: atomically replaced JSON records under ignored `data/`, serialized writes. Appropriate for a small local collection, not concurrent server replicas.
- `lib/twitch.ts`: OAuth sessions and official API client.
- `app/api/`: ingestion, search, private range-capable media delivery, and Twitch endpoints.

Confidence labels are retrieval heuristics, not probability estimates. Semantic-only results are conservatively labeled weak; evidence is quoted directly from the saved index, never generated at query time. An AI outage falls back to keyword search. If you change embedding models, existing vectors are not silently mixed with new query vectors.

This app does not continuously sync channels. It does not yet provide production user accounts, a distributed queue, encrypted-at-rest storage, upload streaming, or a database vector index. Demo/local uploads are shared within this single-machine workspace. Keep the default loopback binding. Files are stored on disk until you remove the local `data/` directory; do not commit it.

## Validation

```sh
npm run check
npm test
npm run build
```

Tests cover combined evidence, weak/no matches, exclusion of unprocessed videos, vector-model compatibility, safe Twitch URLs, OAuth state/scopes/token refresh, and real FFmpeg ingestion against a deterministic **test-only provider stub**. The stub is used only by tests and never supplies app/demo upload results. Live AI and Twitch verification requires your own configured accounts.

With a local dev server running and AI credentials disabled, `npm run test:browser` checks local upload behavior, byte-range delivery, authorization errors, and mobile layout. It removes only its own uniquely named upload fixture afterward.

To regenerate private test media (requires Chromium installed via `npx playwright install chromium`):

```sh
node scripts/make-samples.mjs
```

API implementation references: [timestamped transcription](https://developers.openai.com/api/docs/guides/speech-to-text) and [vision inputs](https://developers.openai.com/api/docs/guides/images-vision?api-mode=chat).
