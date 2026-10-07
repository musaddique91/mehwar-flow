# syntax=docker/dockerfile:1.7
# Monorepo build with one slim runtime image per process:
#   web     Next.js standalone server only (no node_modules tree)
#   api     production deps + Chromium (WhatsApp Web); also runs `prisma migrate deploy`
#   worker  production deps + ffmpeg
# `build` holds the full toolchain and is never shipped (local compose uses it for migrations).

FROM node:26.3.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
# openssl: Prisma's query engine links against it at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
  && npm install -g corepack && corepack enable
WORKDIR /app

FROM base AS manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/connectors/package.json packages/connectors/
COPY packages/crypto/package.json packages/crypto/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/

FROM manifests AS deps
# whatsapp-web.js uses the system Chromium (CHROME_BIN), so skip puppeteer's own browser download.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
# Next.js bakes rewrites in at build time, so the API address inside the compose network is a build arg.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
COPY . .
# No turbo cache: it never survives an image build, and replaying it fails under amd64 emulation.
RUN pnpm turbo run build --cache=local:,remote:

# Production-only node_modules for api, worker and their workspace packages: no Next.js, no
# TypeScript/Nest CLI/vitest, no web deps. This is what keeps the server images small.
FROM manifests AS prod-deps
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY packages/db/prisma packages/db/prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --prod --filter "@mehwar/api..." --filter "@mehwar/worker..." \
  && pnpm --filter @mehwar/db exec prisma generate

# Shared by api and worker: prod deps plus each package's compiled dist/ (sources stay behind).
FROM base AS server
ENV NODE_ENV=production
COPY --from=prod-deps /app ./
COPY --from=build /app/packages/connectors/dist packages/connectors/dist
COPY --from=build /app/packages/crypto/dist packages/crypto/dist
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/storage/dist packages/storage/dist

FROM server AS worker
# ffmpeg/ffprobe read video metadata and render poster frames.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/apps/worker/dist apps/worker/dist
WORKDIR /app/apps/worker
USER node
CMD ["node", "dist/main.js"]

FROM server AS api
# Chromium runs WhatsApp Web (whatsapp-web.js). Its session lives in apps/api/.wwebjs_auth, which
# compose mounts as a volume; created here so the volume starts out owned by `node`.
ENV CHROME_BIN=/usr/bin/chromium
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/apps/api/dist apps/api/dist
RUN mkdir -p apps/api/.wwebjs_auth apps/api/.wwebjs_cache \
  && chown -R node:node apps/api/.wwebjs_auth apps/api/.wwebjs_cache
WORKDIR /app/apps/api
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]

# Last stage, so a plain `docker build .` yields the web image. Next's standalone output already
# traces exactly the node_modules files the server needs.
FROM node:26.3.0-bookworm-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
