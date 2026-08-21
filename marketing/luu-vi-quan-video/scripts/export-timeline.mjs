// Dumps the shared timeline to JSON so the Python sound designer can read the
// exact same cue list the animation uses.
//
//   node scripts/export-timeline.mjs            # the CG cut
//   node scripts/export-timeline.mjs --film photo   # the photo cut
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIDEO, SCENES, CUES, MUSIC, BRAND } from '../scene/timeline.js';
import { PHOTO_CUES } from '../scene/shots.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--film');
const film = i > -1 ? process.argv[i + 1] : 'cg';
const cues = film === 'photo' ? PHOTO_CUES : CUES;

const out = path.join(ROOT, 'audio', film === 'photo' ? 'timeline-photo.json' : 'timeline.json');
fs.writeFileSync(out, JSON.stringify({ VIDEO, SCENES, CUES: cues, MUSIC, BRAND }, null, 2));
console.log('wrote', out, `(${film} cut, ${cues.length} cues)`);
