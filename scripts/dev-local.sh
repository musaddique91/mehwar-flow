#!/usr/bin/env bash
# Run Mehwar Flow locally with hot reload.
#
#   scripts/dev-local.sh                 # infra + migrations + api, worker and web
#   scripts/dev-local.sh api web         # only the apps you name (any of: api worker web)
#   scripts/dev-local.sh infra           # only the Docker infra (redis, minio, mailpit)
#   scripts/dev-local.sh stop            # stop the Docker infra (data is kept)
#
# Postgres is the one on this Mac (localhost:5432, URLs from .env). Redis, MinIO and Mailpit
# run in Docker. Web http://localhost:3000 · API http://localhost:4000 · Mail http://localhost:8025
# Ctrl+C stops the apps. Changes under packages/* need a restart (they are built once at start).
set -euo pipefail
cd "$(dirname "$0")/.."

INFRA=(redis minio minio-init mailpit)
usage() { sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

APPS=()
MODE=run
for arg in "$@"; do
  case "$arg" in
    api | worker | web) APPS+=("$arg") ;;
    ui) APPS+=(web) ;;
    infra) MODE=infra ;;
    stop) MODE=stop ;;
    -h | --help) usage ;;
    *) echo "unknown argument: $arg" >&2; usage ;;
  esac
done
[ ${#APPS[@]} -gt 0 ] || APPS=(api worker web)

docker info >/dev/null 2>&1 || { echo "Docker is not running (start Docker Desktop)." >&2; exit 1; }

if [ "$MODE" = stop ]; then
  docker compose stop "${INFRA[@]}"
  exit 0
fi

[ -f .env ] || { echo "No .env — run ./scripts/generate-env.sh first." >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a
export REFRESH_COOKIE_PATH="${REFRESH_COOKIE_PATH:-/api/auth}"

echo "==> Docker infra: ${INFRA[*]}"
docker compose up -d "${INFRA[@]}"
[ "$MODE" = infra ] && exit 0

# Host Postgres must be up; take host:port from DATABASE_URL.
PG_HOSTPORT=$(sed -E 's#^[^@]*@([^/]+)/.*#\1#' <<<"$DATABASE_URL")
nc -z "${PG_HOSTPORT%:*}" "${PG_HOSTPORT##*:}" 2>/dev/null \
  || { echo "Postgres is not reachable at $PG_HOSTPORT (start it first)." >&2; exit 1; }

if [ ! -d node_modules ] || [ pnpm-lock.yaml -nt node_modules/.modules.yaml ]; then
  echo "==> pnpm install"
  pnpm install
fi

echo "==> Building shared packages"
pnpm turbo run build --filter='./packages/*' --output-logs=errors-only

echo "==> Migrations"
pnpm db:migrate

# Run the chosen apps side by side with prefixed output; Ctrl+C stops them all.
# Job control gives each app its own process group, so stopping one stops pnpm and every node
# process it started (nest/next watchers included).
set -m
PIDS=()
cleanup() {
  trap - INT TERM EXIT
  echo; echo "==> Stopping ${APPS[*]}"
  for pid in "${PIDS[@]}"; do kill -TERM -- "-$pid" 2>/dev/null || true; done
  sleep 2
  for pid in "${PIDS[@]}"; do kill -KILL -- "-$pid" 2>/dev/null || true; done
}
trap cleanup INT TERM EXIT

for app in "${APPS[@]}"; do
  (pnpm --filter "@mehwar/$app" dev 2>&1 | sed -u "s/^/[$app] /") &
  PIDS+=($!)
done

echo "==> Running ${APPS[*]}  (web http://localhost:3000 & https://localhost:3000, api http://localhost:4000/health)"
wait
