# Mehwar Flow

Social account management SaaS: connect your social accounts (X, Facebook Pages, Instagram,
Threads, YouTube, TikTok, Snapchat), write once, preview per network, schedule in your time zone,
and publish.

- Requirements & corrected platform specs: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- **Connecting the networks (developer apps, callback URLs, env vars):**
  [`docs/PLATFORM_SETUP.md`](docs/PLATFORM_SETUP.md)
- Current scope: personal accounts (one login manages its own channels). Teams/roles come later.

## Features

- **Composer:** write once, choose channels, and fine-tune per network:
  - custom text per network, thread blocks, YouTube title, privacy and made-for-kids, TikTok
    privacy and disclosure, Instagram post/reel/story and first comment;
  - live character rings, validation and previews for every network;
  - drag-and-drop media upload, emoji picker and an AI writing assistant.
- **Scheduling:** schedule in your time zone, "next free slot" from your weekly posting slots, post
  now, drafts, retry failed posts, and CSV bulk import.
- **Calendar:** month and week views; drag a post to another day to reschedule it.
- **Publishing engine:**
  - X, Facebook Pages, Instagram, Threads, YouTube and TikTok (Snapchat behind a flag);
  - automatic token refresh, retries, and "reconnect" alerts;
  - live status in the feed.
- **Media library** (MinIO): thumbnails, JPEG conversion for Instagram, and video metadata via ffmpeg.
- **Analytics:** nightly stats per post and network, trends, top posts, and CSV export.
- **Notifications:** in-app bell, live toasts, and email on failures (Mailpit in development).
- **Plans & billing** (optional Stripe); **GDPR** data export and account deletion; queue dashboard.

## Stack

| Part                  | Tech                                                                         |
| --------------------- | ---------------------------------------------------------------------------- |
| `apps/web`            | Next.js 15 + Tailwind + motion (proxies `/api/*` to the API)                 |
| `apps/api`            | NestJS 11: auth, channels (OAuth), media, posts, analytics, AI, billing      |
| `apps/worker`         | BullMQ: publishing, token refresh, media processing, metrics, schedule sweep |
| `packages/connectors` | One connector per network (OAuth, publish pipelines, metrics)                |
| `packages/storage`    | MinIO/S3 client (presigned uploads, public copies)                           |
| `packages/db`         | Prisma schema, migrations, Postgres Row-Level Security, token vault          |
| `packages/crypto`     | AES-256-GCM envelope encryption, password hashing                            |
| `packages/shared`     | Per-network rules & validation, time-zone helpers, API schemas               |
| Infra                 | PostgreSQL 16, Redis 7, MinIO (S3), Mailpit, all in Docker Compose           |

## Run everything with Docker (recommended)

Requirements: Docker Desktop / Docker Engine with Compose v2, `openssl`.

```bash
git clone https://github.com/musaddique91/mehwar-flow.git
cd mehwar-flow
git checkout musa/vibrant-faraday-nqeuh4

./scripts/generate-env.sh          # once: creates .env with random secrets
docker compose up -d --build       # builds images, runs DB migrations, starts everything
docker compose ps                  # all services "running"/"healthy"; migrate & minio-init "exited (0)"
```

Open:

| URL                                | What                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| http://localhost:3000              | Web app: sign up, then the dashboard                                          |
| http://localhost:4000/health       | API health                                                                    |
| http://localhost:9001              | MinIO console (user `mehwar-admin`, password `MINIO_ROOT_PASSWORD` in `.env`) |
| http://localhost:8025              | Mailpit (captured dev emails)                                                 |
| http://localhost:4000/admin/queues | Job queues (login `ADMIN_USER` / `ADMIN_PASSWORD` from `.env`)                |

To connect real accounts, create the developer apps and fill in the keys in `.env` as described
in [`docs/PLATFORM_SETUP.md`](docs/PLATFORM_SETUP.md), then run `docker compose up -d api worker`.

Useful commands:

```bash
docker compose logs -f api worker  # follow logs
docker compose up -d --build api   # rebuild one service after code changes
docker compose down                # stop (data is kept in volumes)
docker compose down -v             # stop and DELETE all data (DB, Redis, MinIO)
```

> Windows: run `scripts/generate-env.sh` from Git Bash or WSL, or copy `.env.example` to `.env`
> and fill in the values by hand (`openssl rand -base64 32` for `MASTER_KEYS=1:<key>`).
>
> Keep `.env` safe: `MASTER_KEYS` encrypts every stored social token. Losing it makes the stored
> tokens unreadable.

## Local development (hot reload, without app containers)

```bash
corepack enable                    # provides pnpm (requires Node 26.3.0, see .nvmrc)
pnpm install
./scripts/generate-env.sh          # if you don't have .env yet
docker compose up -d postgres redis minio minio-init mailpit

# Load the secrets from .env into your shell
set -a; . ./.env; set +a
export DIRECT_DATABASE_URL=postgresql://mehwar:$POSTGRES_PASSWORD@localhost:5432/mehwar
export DATABASE_URL=postgresql://mehwar_app:$POSTGRES_APP_PASSWORD@localhost:5432/mehwar
export REDIS_URL=redis://localhost:6379 REFRESH_COOKIE_PATH=/api/auth

pnpm build                         # builds the shared packages once
pnpm db:migrate                    # apply migrations
pnpm --filter @mehwar/api dev      # API on :4000   (terminal 1)
pnpm --filter @mehwar/worker dev   # worker         (terminal 2)
pnpm --filter @mehwar/web dev      # web on :3000   (terminal 3)
```

Tests (need the Postgres from compose and the env vars above):

```bash
pnpm test
```

## Security model (short)

- Each user gets a personal organization; every tenant row has `organization_id`, enforced by
  Postgres **Row-Level Security**. The app connects as the non-owner role `mehwar_app`.
- Social tokens are encrypted with a per-organization data key, which is itself wrapped by a
  versioned master key (`MASTER_KEYS`). To rotate: add `2:<new key>`, set
  `MASTER_KEY_CURRENT_VERSION=2`, and keep `1:` until all keys are re-wrapped.
- Refresh tokens live in an httpOnly cookie and rotate on every use; reusing an old one revokes the session.

## Roadmap

Done: foundation, media library, composer, connectors and publishing, scheduling and calendar,
notifications, analytics, AI assistant, billing, and GDPR tools.

Next:

- Real-account testing and the platform app reviews (Meta, Google, TikTok, X paid tier).
- Teams, roles and approvals.
- A unified inbox (reply to comments and DMs).
- More networks: LinkedIn, Pinterest, Bluesky.
