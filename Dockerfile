# Production image. Used for the hosted demo (Hugging Face Spaces, Render,
# or any Docker host). FFmpeg is included so uploads also work when the
# read-only flag is turned off.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=7860 \
  CLIPDEXER_DATA_DIR=/app/demo-data
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/demo-data && chown -R node:node /app/demo-data
USER node
EXPOSE 7860
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT}"]
