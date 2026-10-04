import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const gatewayScript = path.join(rootDir, 'scripts/dev-gateway.mjs');

const internalPort = process.env.WEB_INTERNAL_PORT || '3002';
const publicPort = process.env.WEB_PORT || '3000';

console.log(`[web] Starting Mehwar Flow Web with Dual HTTP/HTTPS Support...`);

// 1. Start Dual HTTP/HTTPS multiplexer gateway on port 3000
const gateway = spawn('node', [gatewayScript], {
  stdio: 'inherit',
  env: {
    ...process.env,
    WEB_PORT: publicPort,
    WEB_INTERNAL_PORT: internalPort,
  },
});

// 2. Start Next.js dev server on internal port 3002
const nextDev = spawn('pnpm', ['exec', 'next', 'dev', '-p', internalPort], {
  stdio: 'inherit',
  cwd: __dirname,
  env: process.env,
});

function cleanup() {
  try {
    gateway.kill('SIGTERM');
  } catch {}
  try {
    nextDev.kill('SIGTERM');
  } catch {}
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('exit', cleanup);

nextDev.on('exit', (code) => {
  cleanup();
  process.exit(code ?? 0);
});

gateway.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[gateway] Multiplexer exited with code ${code}`);
  }
});
