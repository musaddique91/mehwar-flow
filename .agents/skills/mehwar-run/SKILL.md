---
name: mehwar-run
description: >-
  Runs the Mehwar Flow application stack: Docker infrastructure containers (Redis, MinIO, Mailpit),
  host PostgreSQL database on localhost:5432, and local node/pnpm dev processes for API, Worker, and Web.
  Activate when asked to run, start, pull, or test Mehwar Flow locally.
---

# Mehwar Flow - Local Development Stack Runbook

Follow this standard execution workflow whenever requested to run, start, update, or test the Mehwar Flow codebase.

## 1. Infrastructure Stack (Docker Containers)

Run ONLY infrastructure containers in Docker. Stop app/database containers if running:

```bash
# Start infrastructure containers
docker compose up -d redis minio minio-init mailpit

# Stop app/database containers in Docker (since Postgres & Node apps run locally)
docker compose stop web api worker postgres migrate
```

- **Redis:** `redis://localhost:6380`
- **MinIO:** `http://localhost:9000` (Console: `http://localhost:9001`)
- **Mailpit:** `http://localhost:8025` (SMTP: `127.0.0.1:1025`)

## 2. PostgreSQL Database (Host Local Machine)

Use the host's PostgreSQL server on `localhost:5432`:

- **Superuser / Direct URL:** `postgresql://postgres:root@localhost:5432/mehwar`
- **App RLS URL:** `postgresql://mehwar_app:root@localhost:5432/mehwar`

### Schema Setup & Migrations
```bash
# Run database migrations against host Postgres
DIRECT_DATABASE_URL="postgresql://postgres:root@localhost:5432/mehwar" \
DATABASE_URL="postgresql://mehwar_app:root@localhost:5432/mehwar" \
pnpm --filter @mehwar/db migrate:deploy

# Grant permissions to mehwar_app role for Row-Level Security
pnpm prisma db execute --url "postgresql://postgres:root@localhost:5432/mehwar" --stdin << 'EOF'
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mehwar_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mehwar_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mehwar_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mehwar_app;
EOF
```

## 3. Environment Configuration (`.env`)

Ensure `.env` in the repository root has the local dev values:

```env
DATABASE_URL=postgresql://mehwar_app:root@localhost:5432/mehwar
DIRECT_DATABASE_URL=postgresql://postgres:root@localhost:5432/mehwar
REDIS_URL=redis://localhost:6380
POSTGRES_PASSWORD=root
POSTGRES_APP_PASSWORD=root
MINIO_ROOT_USER=mehwar-admin
MINIO_ROOT_PASSWORD=36ab69c5ad426f1cce34996e1fb3a21e9975b426612aa661
S3_BUCKET=mehwar-media
S3_ACCESS_KEY=mehwar-app
S3_SECRET_KEY=02cb04984bb6a5c94826f4ac9eb55959d77e6bab51bbdd90
S3_ENDPOINT=http://localhost:9000
S3_PUBLIC_URL=http://localhost:9000
SMTP_URL=smtp://localhost:1025
PORT=4000
JWT_ACCESS_SECRET=aiD+U8PQXVigrNU+95fha/fO9N3O492TwKsSXoPifvS5CJH3Quk0ehNkKu5fW8ad
MASTER_KEYS=1:Z9tOVHNXQCyOHpE1w9VozfJy48X+4nsjEnvRr3WtQKA=
MASTER_KEY_CURRENT_VERSION=1
WEB_ORIGIN=http://localhost:3000,https://localhost:3000
WEB_PORT=3000
COOKIE_SECURE=false
API_INTERNAL_URL=http://localhost:4000
```

## 4. Run App Dev Processes (Local Node Services)

First build workspace packages, then launch API, Worker, and Web:

```bash
# 1. Build monorepo packages
pnpm build

# 2. Launch API Backend (NestJS on :4000)
export $(grep -v '^#' .env | xargs) && pnpm --filter @mehwar/api dev

# 3. Launch Worker (BullMQ background processing)
export $(grep -v '^#' .env | xargs) && pnpm --filter @mehwar/worker dev

# 4. Launch Web Frontend (Dual HTTP/HTTPS on :3000)
export $(grep -v '^#' .env | xargs) && pnpm --filter @mehwar/web dev
```

## 5. Verification

Verify server endpoints:
- API Health: `curl -i http://localhost:4000/health`
- Web App (HTTP): `curl -i http://localhost:3000`
- Web App (HTTPS): `curl -k -i https://localhost:3000`
- User Login Test (`musajs91@gmail.com` / `Redhat7676`):
  `curl -i -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"musajs91@gmail.com","password":"Redhat7676"}'`

