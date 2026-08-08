import { createServer } from 'node:http';

const port = 3000;
const maxBodyBytes = 1024 * 1024;
const maxRequests = 100;
const requests = [];

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/requests') {
    sendJson(response, 200, { requests });
    return;
  }

  if (request.method === 'DELETE' && url.pathname === '/requests') {
    requests.length = 0;
    sendJson(response, 200, { status: 'cleared' });
    return;
  }

  if (request.method === 'POST') {
    try {
      const body = await readBody(request);
      requests.push({
        id: crypto.randomUUID(),
        path: url.pathname,
        receivedAt: new Date().toISOString(),
        headers: {
          contentType: request.headers['content-type'] ?? null,
          event: request.headers['x-anyhunt-event'] ?? null,
          idempotencyKey: request.headers['idempotency-key'] ?? null,
          signature: request.headers['x-anyhunt-signature'] ?? null,
        },
        body,
      });
      if (requests.length > maxRequests) requests.shift();
      sendJson(response, 202, { status: 'accepted' });
    } catch (error) {
      const status = error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
      sendJson(response, status, {
        error: status === 413 ? 'Payload too large' : 'Invalid request',
      });
    }
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
});

server.listen(port, '0.0.0.0');

function shutdown() {
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
