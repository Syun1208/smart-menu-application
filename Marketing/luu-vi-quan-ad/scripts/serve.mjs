// Static server toi gian cho preview va cho render offline.
// Phuc vu tu goc du an de /src, /assets, /build, /content, /node_modules deu truy cap duoc.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

export function createServer() {
  return http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/src/index.html';
    if (rel === '/favicon.ico') { res.writeHead(204).end(); return; }
    const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end('not found: ' + rel); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(buf);
    });
  });
}

export function listen(port = 0) {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(port, '127.0.0.1', () => resolve({ server: s, port: s.address().port }));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await listen(parseInt(process.env.PORT || '5178', 10));
  console.log(`Preview: http://127.0.0.1:${port}/`);
}
