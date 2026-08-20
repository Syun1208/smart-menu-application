// Dumps the shared timeline to JSON so the Python sound designer can read the
// exact same cue list the animation uses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIDEO, SCENES, CUES, MUSIC, BRAND } from '../scene/timeline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(ROOT, 'audio', 'timeline.json');
fs.writeFileSync(out, JSON.stringify({ VIDEO, SCENES, CUES, MUSIC, BRAND }, null, 2));
console.log('wrote', out, `(${CUES.length} cues)`);
