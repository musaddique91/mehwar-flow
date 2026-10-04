import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.join(__dirname, '../certs');
const keyPath = path.join(certDir, 'localhost.key');
const crtPath = path.join(certDir, 'localhost.crt');

// Ensure certs exist
if (!fs.existsSync(keyPath) || !fs.existsSync(crtPath)) {
  fs.mkdirSync(certDir, { recursive: true });
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj "/CN=localhost" ` +
        `-keyout "${keyPath}" -out "${crtPath}" -days 365 ` +
        `-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
      { stdio: 'ignore' },
    );
  } catch (e) {
    console.error('[gateway] Failed to generate self-signed cert with openssl:', e);
  }
}

const key = fs.readFileSync(keyPath);
const cert = fs.readFileSync(crtPath);

const PUBLIC_PORT = parseInt(process.env.WEB_PORT || '3000', 10);
const INTERNAL_HTTP_PORT = parseInt(process.env.WEB_INTERNAL_PORT || '3002', 10);
const INTERNAL_HTTPS_PORT = 3001;

function proxyRequest(req, res, isHttps) {
  const headers = { ...req.headers };
  headers['x-forwarded-proto'] = isHttps ? 'https' : 'http';
  headers['x-forwarded-host'] = req.headers.host || `localhost:${PUBLIC_PORT}`;
  headers['x-forwarded-port'] = `${PUBLIC_PORT}`;

  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: INTERNAL_HTTP_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Gateway Error: Next.js is not responding on port ' + INTERNAL_HTTP_PORT);
    }
  });

  req.pipe(proxyReq);
}

function proxyUpgrade(req, socket, head, isHttps) {
  const headers = { ...req.headers };
  headers['x-forwarded-proto'] = isHttps ? 'https' : 'http';
  headers['x-forwarded-host'] = req.headers.host || `localhost:${PUBLIC_PORT}`;
  headers['x-forwarded-port'] = `${PUBLIC_PORT}`;

  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: INTERNAL_HTTP_PORT,
    path: req.url,
    method: req.method,
    headers,
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n` +
        Object.entries(proxyRes.headers)
          .map(([k, v]) => `${k}: ${v}\r\n`)
          .join('') +
        '\r\n',
    );
    if (proxyHead && proxyHead.length) socket.write(proxyHead);
    proxySocket.pipe(socket).pipe(proxySocket);
  });

  proxyReq.on('error', () => {
    socket.destroy();
  });

  proxyReq.end();
}

// Internal HTTPS Server
const httpsServer = https.createServer({ key, cert }, (req, res) => {
  proxyRequest(req, res, true);
});
httpsServer.on('upgrade', (req, socket, head) => {
  proxyUpgrade(req, socket, head, true);
});
httpsServer.listen(INTERNAL_HTTPS_PORT, '127.0.0.1');

// Port 3000 Multiplexer (sniffs TLS vs Plain HTTP)
const mux = net.createServer((clientSocket) => {
  clientSocket.once('data', (firstChunk) => {
    const isTls = firstChunk.length > 0 && firstChunk[0] === 0x16;
    const targetPort = isTls ? INTERNAL_HTTPS_PORT : INTERNAL_HTTP_PORT;

    const serverSocket = net.createConnection(
      { host: '127.0.0.1', port: targetPort },
      () => {
        serverSocket.write(firstChunk);
        clientSocket.pipe(serverSocket).pipe(clientSocket);
      },
    );

    serverSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => serverSocket.destroy());
  });

  clientSocket.on('error', () => {});
});

mux.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`[gateway] Dual HTTP/HTTPS multiplexer running on port ${PUBLIC_PORT}`);
  console.log(`[gateway] -> HTTP : http://localhost:${PUBLIC_PORT}`);
  console.log(`[gateway] -> HTTPS: https://localhost:${PUBLIC_PORT}`);
  console.log(`[gateway] Proxying to Next.js on port ${INTERNAL_HTTP_PORT}`);
});
