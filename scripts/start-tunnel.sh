#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# start-tunnel.sh
# Starts a Cloudflare quick tunnel for MinIO, extracts the URL,
# updates S3_PUBLIC_URL in .env, then restarts API + Worker.
# Usage: ./scripts/start-tunnel.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# Ensure standard PATHs are present (Homebrew, Node, pnpm, NVM)
for p in \
  "$HOME/Library/pnpm" \
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin" \
  "/opt/homebrew/bin" \
  "/usr/local/bin"; do
  if [ -d "$p" ] && [[ ":$PATH:" != *":$p:"* ]]; then
    export PATH="$p:$PATH"
  fi
done

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
LOG_FILE="/tmp/cf-tunnel-minio.log"
MINIO_PORT=9000
API_PORT=4000

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "❌ Error: 'cloudflared' CLI is not installed or not in PATH."
  echo "   Install it with: brew install cloudflared"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "❌ Error: 'pnpm' is not installed or not in PATH."
  exit 1
fi

echo "🚇 Checking MinIO on localhost:${MINIO_PORT} ..."
if ! nc -z localhost "${MINIO_PORT}" 2>/dev/null && ! curl -s "http://localhost:${MINIO_PORT}" >/dev/null 2>&1; then
  echo "⚠️ MinIO is not responding on port ${MINIO_PORT}. Starting infrastructure containers..."
  (cd "$ROOT_DIR" && docker compose up -d redis minio minio-init mailpit)
  sleep 2
fi

echo "🚇 Starting Cloudflare tunnel → localhost:${MINIO_PORT} ..."

# Kill any existing tunnel process
pkill -f "cloudflared tunnel.*${MINIO_PORT}" 2>/dev/null || true
sleep 1

rm -f "$LOG_FILE"

# Start tunnel in background, redirect output to log file
cloudflared tunnel --url "http://localhost:${MINIO_PORT}" > "$LOG_FILE" 2>&1 &
TUNNEL_PID=$!
echo "   tunnel PID: $TUNNEL_PID"

# Ensure tunnel process is terminated when script exits
cleanup() {
  echo ""
  echo "🛑 Stopping Cloudflare tunnel (PID: $TUNNEL_PID)..."
  kill "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for the public URL to appear in the log (up to 45s)
echo "   Waiting for tunnel URL..."
PUBLIC_URL=""
for i in $(seq 1 45); do
  if [ -f "$LOG_FILE" ]; then
    PUBLIC_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' "$LOG_FILE" 2>/dev/null | head -1 || true)
    if [ -n "$PUBLIC_URL" ]; then
      break
    fi
  fi
  sleep 1
done

if [ -z "$PUBLIC_URL" ]; then
  echo "❌ Failed to get tunnel URL after 45s. Check $LOG_FILE"
  exit 1
fi

echo "✅ Tunnel live: $PUBLIC_URL"

# Safely update S3_PUBLIC_URL in .env using Node.js to avoid sed/quoting edge cases
node -e "
const fs = require('fs');
const envPath = process.argv[1];
const newUrl = process.argv[2];
let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
if (/^S3_PUBLIC_URL=.*$/m.test(content)) {
  content = content.replace(/^S3_PUBLIC_URL=.*$/m, 'S3_PUBLIC_URL=' + newUrl);
} else {
  content = content.trimEnd() + '\nS3_PUBLIC_URL=' + newUrl + '\n';
}
fs.writeFileSync(envPath, content);
" "$ENV_FILE" "$PUBLIC_URL"

echo "✅ Updated .env → S3_PUBLIC_URL=${PUBLIC_URL}"

# Restart API + Worker with new S3_PUBLIC_URL
echo ""
echo "🔄 Restarting API + Worker with new S3_PUBLIC_URL ..."

# Safely terminate existing API and Worker processes
EXISTING_API_PIDS=$(lsof -ti :"$API_PORT" 2>/dev/null || true)
if [ -n "$EXISTING_API_PIDS" ]; then
  echo "   Stopping existing process on port $API_PORT ($EXISTING_API_PIDS)..."
  kill -15 $EXISTING_API_PIDS 2>/dev/null || true
  sleep 1
  kill -9 $EXISTING_API_PIDS 2>/dev/null || true
fi
pkill -f "apps/api/dist/main" 2>/dev/null || true
pkill -f "apps/worker/dist/main" 2>/dev/null || true
pkill -f "@mehwar/api.*dev" 2>/dev/null || true
pkill -f "@mehwar/worker.*dev" 2>/dev/null || true
sleep 1

# Load environment variables cleanly
set -a
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
set +a
export $(grep -v '^#' "$ENV_FILE" | xargs)

cd "$ROOT_DIR"

nohup pnpm --filter @mehwar/api dev > /tmp/mehwar-api.log 2>&1 &
API_PID=$!
echo "   API started (PID $API_PID), log: /tmp/mehwar-api.log"

nohup pnpm --filter @mehwar/worker dev > /tmp/mehwar-worker.log 2>&1 &
WORKER_PID=$!
echo "   Worker started (PID $WORKER_PID), log: /tmp/mehwar-worker.log"

# Wait a few seconds and verify API health
echo "   Verifying API health..."
for i in $(seq 1 15); do
  if curl -s "http://localhost:${API_PORT}/health" | grep -q '"status":"ok"'; then
    echo "   ✅ API is healthy on port ${API_PORT}"
    break
  fi
  sleep 1
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ All done!"
echo "  📦 MinIO public URL : $PUBLIC_URL"
echo "  🌐 App              : http://localhost:3000"
echo "  📡 Tunnel log       : $LOG_FILE"
echo "  📄 API log          : /tmp/mehwar-api.log"
echo "  📄 Worker log       : /tmp/mehwar-worker.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Instagram & Meta media uploads will use this public tunnel."
echo "  Keep this terminal open while testing Instagram / webhook features."
echo "  Press Ctrl+C to terminate the tunnel."
echo ""

# Keep tunnel alive in foreground
wait "$TUNNEL_PID"
