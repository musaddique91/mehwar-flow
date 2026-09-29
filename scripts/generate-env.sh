#!/usr/bin/env sh
# Creates .env for docker compose with strong random secrets. Refuses to overwrite an existing one.
set -eu
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  echo ".env already exists; delete it first if you really want new secrets (existing data would become unreadable)." >&2
  exit 1
fi
rand() { openssl rand -base64 "$1" | tr -d '\n'; }
alnum() { openssl rand -hex "$1"; }
cat > .env <<ENV
POSTGRES_PASSWORD=$(alnum 24)
POSTGRES_APP_PASSWORD=$(alnum 24)
MINIO_ROOT_USER=mehwar-admin
MINIO_ROOT_PASSWORD=$(alnum 24)
S3_BUCKET=mehwar-media
S3_ACCESS_KEY=mehwar-app
S3_SECRET_KEY=$(alnum 24)
# Public base URL of MinIO as reachable by browsers and by social platforms pulling media.
S3_PUBLIC_URL=http://localhost:9000
JWT_ACCESS_SECRET=$(rand 48)
# AES-256 master key ring for the token vault. Back this up: losing it makes stored tokens unreadable.
MASTER_KEYS=1:$(rand 32)
MASTER_KEY_CURRENT_VERSION=1
WEB_ORIGIN=http://localhost:3000
COOKIE_SECURE=false

# ---------- Optional integrations (see docs/PLATFORM_SETUP.md) ----------
# A network is enabled once both its client id and secret are set.
X_CLIENT_ID=
X_CLIENT_SECRET=
# One Meta app covers Facebook Pages and Instagram.
META_CLIENT_ID=
META_CLIENT_SECRET=
THREADS_CLIENT_ID=
THREADS_CLIENT_SECRET=
# Google Cloud OAuth client (YouTube).
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# TikTok: use the app's Client key as TIKTOK_CLIENT_ID.
TIKTOK_CLIENT_ID=
TIKTOK_CLIENT_SECRET=
# Snapchat needs Snap partner access for publishing.
FEATURE_SNAPCHAT=false
SNAPCHAT_CLIENT_ID=
SNAPCHAT_CLIENT_SECRET=
SNAPCHAT_PUBLISH_URL=

# AI assistant (Claude)
ANTHROPIC_API_KEY=
AI_MODEL=claude-opus-5-5

# Stripe billing (leave empty for a self-hosted install with no plan limits)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=

# Queue dashboard at http://localhost:4000/admin/queues
ADMIN_USER=admin
ADMIN_PASSWORD=$(alnum 12)

# Outgoing email (defaults to the Mailpit dev inbox)
SMTP_URL=smtp://mailpit:1025
MAIL_FROM=Mehwar Flow <no-reply@mehwar.local>
ENV
chmod 600 .env
echo "Wrote .env"
