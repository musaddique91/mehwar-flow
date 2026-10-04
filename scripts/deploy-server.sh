#!/usr/bin/env bash
# Build the app image on this machine and deploy it to the MVX server (/opt/mehwar-flow).
#
#   scripts/deploy-server.sh all            # web + api + worker
#   scripts/deploy-server.sh web            # UI only
#   scripts/deploy-server.sh api worker     # any combination of: web api worker
#
# One image holds every process, so each run builds it once; only the chosen containers are
# recreated, the rest keep running. Migrations always run first (they are a no-op when there
# is nothing new). Nothing outside the mehwar-flow compose project is touched.
set -euo pipefail

HOST="${DEPLOY_HOST:-mvx-ubuntu}"
DIR=/opt/mehwar-flow
PROJECT=mehwar-flow
KEEP_IMAGES=3

usage() { sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
[ $# -gt 0 ] || usage

SERVICES=()
for arg in "$@"; do
  case "$arg" in
    all) SERVICES=(mehwar-flow-api mehwar-flow-worker mehwar-flow-web) ;;
    web | ui) SERVICES+=(mehwar-flow-web) ;;
    api) SERVICES+=(mehwar-flow-api) ;;
    worker) SERVICES+=(mehwar-flow-worker) ;;
    *) echo "unknown target: $arg" >&2; usage ;;
  esac
done
read -r -a SERVICES <<<"$(printf '%s\n' "${SERVICES[@]}" | sort -u | tr '\n' ' ')"

cd "$(dirname "$0")/.."
docker info >/dev/null 2>&1 || { echo "Docker is not running (start Docker Desktop)." >&2; exit 1; }

TAG="mehwar-flow-app:$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  TAG="$TAG-dirty-$(date +%Y%m%d-%H%M%S)"
  echo "note: uncommitted changes are included in this build"
fi

echo "==> Building $TAG (linux/amd64)"
docker buildx build --platform linux/amd64 -t "$TAG" --load .

echo "==> Uploading image to $HOST"
docker save "$TAG" | gzip -1 | ssh -o BatchMode=yes "$HOST" 'gunzip | sudo docker load'

echo "==> Syncing compose file"
sed 's/__BACKEND_CONTAINER_NAME__/mehwar-flow-api/g; s/__FRONTEND_CONTAINER_NAME__/mehwar-flow-web/g' \
  docker-compose-jenkins.yaml | ssh -o BatchMode=yes "$HOST" "cat > /tmp/mehwar-flow-compose.yml"

echo "==> Deploying: ${SERVICES[*]}"
ssh -o BatchMode=yes "$HOST" bash -s -- "$TAG" "${SERVICES[@]}" <<REMOTE
set -euo pipefail
TAG="\$1"; shift
cd $DIR
if ! sudo cmp -s /tmp/mehwar-flow-compose.yml docker-compose.yml; then
  sudo cp docker-compose.yml "docker-compose.yml.bak-\$(date +%Y%m%d-%H%M%S)"
  sudo mv /tmp/mehwar-flow-compose.yml docker-compose.yml
  echo "--> compose file updated (previous one backed up)"
fi
sudo rm -f /tmp/mehwar-flow-compose.yml
sudo sed -i "s|^APP_IMAGE_TAG=.*|APP_IMAGE_TAG=\$TAG|" .env
dc() { sudo docker compose -p $PROJECT "\$@"; }

echo "--> migrations"
# -T and </dev/null: `run` must not read this script from stdin, or the steps below never run.
dc run --rm -T --no-deps mehwar-flow-migrate </dev/null

echo "--> recreating \$*"
dc up -d --no-deps "\$@"

echo "--> health"
for i in \$(seq 1 30); do
  if curl -fsS http://localhost:8032/api/health; then echo; break; fi
  [ "\$i" = 30 ] && { echo "health check failed"; dc logs --tail 40 "\$@"; exit 1; }
  sleep 2
done
dc ps --format '{{.Name}}\t{{.Image}}\t{{.Status}}'

# Keep the newest $KEEP_IMAGES app images; images still used by a container are skipped.
sudo docker images mehwar-flow-app --format '{{.Repository}}:{{.Tag}}' | tail -n +$((KEEP_IMAGES + 1)) \
  | xargs -r sudo docker rmi >/dev/null 2>&1 || true
REMOTE

echo "==> Done: http://80.225.65.196:8032"
