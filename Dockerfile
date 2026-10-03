# syntax=docker/dockerfile:1.7
# Multi-target build for the monorepo: `api`, `worker`, `web` (and `build` for migrations).

FROM node:26.3.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
  && npm install -g corepack && corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/connectors/package.json packages/connectors/
COPY packages/crypto/package.json packages/crypto/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
# Next.js bakes rewrites in at build time, so the API address inside the compose network is a build arg.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
COPY . .
# No turbo cache: it never survives an image build, and replaying it fails under amd64 emulation.
RUN pnpm turbo run build --cache=local:,remote:

FROM build AS api
ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]

FROM build AS worker
ENV NODE_ENV=production
# ffmpeg/ffprobe read video metadata and render poster frames.
USER root
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/worker
USER node
CMD ["node", "dist/main.js"]

FROM node:26.3.0-bookworm-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# Default target (last stage): one image for api, worker, web and migrations, so a plain
# `docker build .` (the shared deploy pipeline) yields everything. Each container picks its
# process via working_dir/command in docker-compose-jenkins.yaml.
FROM build AS app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/* \
  && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static \
  && chown -R node:node apps/web/.next/standalone
USER node
WORKDIR /app/apps/api
EXPOSE 3000 4000
CMD ["node", "dist/main.js"]
