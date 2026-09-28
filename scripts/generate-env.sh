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
ENV
chmod 600 .env
echo "Wrote .env"
