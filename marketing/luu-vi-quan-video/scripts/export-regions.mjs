// Dumps the region table to JSON so the Python contact-sheet script can read the
// exact rectangles the film shader uses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGIONS, PHOTOS } from '../scene/photos.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const regions = Object.fromEntries(
  Object.entries(REGIONS).map(([name, r]) => [name, { src: PHOTOS[r.photo].src, rect: r.rect }]),
);
const out = path.join(ROOT, 'scene', 'regions.json');
fs.writeFileSync(out, JSON.stringify({ regions }, null, 2));
console.log('wrote', out, `(${Object.keys(regions).length} regions)`);
