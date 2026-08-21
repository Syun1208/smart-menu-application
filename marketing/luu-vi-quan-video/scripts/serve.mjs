// Tiny static server used both by the offline renderer and by `npm run preview`.
// It maps /vendor/* onto the installed three.js package so index.html can use a
// clean import map instead of node_modules paths.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
};

function resolveFile(urlPath) {
  if (urlPath === '/' ) return path.join(ROOT, 'scene', 'index.html');
  if (urlPath.startsWith('/vendor/addons/')) {
    return path.join(THREE_DIR, 'examples', 'jsm', urlPath.slice('/vendor/addons/'.length));
  }
  if (urlPath.startsWith('/vendor/')) {
    return path.join(THREE_DIR, 'build', urlPath.slice('/vendor/'.length));
  }
  return path.join(ROOT, urlPath);
}

export function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const file = resolveFile(urlPath);
    if (!file.startsWith(ROOT) && !file.startsWith(THREE_DIR)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found: ' + urlPath);
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// `node scripts/serve.mjs` -> live preview on a fixed port
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 5173);
  await serve(port);
  console.log(`Preview: http://localhost:${port}/scene/index.html?preview=1`);
}
