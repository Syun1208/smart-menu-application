// Chon binary Chromium. Moi truong nay co san Chromium o /opt/pw-browsers
// (bien PLAYWRIGHT_BROWSERS_PATH), co the lech revision voi ban Playwright trong
// node_modules - nen tro thang vao binary co san thay vi tai them.
import fs from 'node:fs';
import { chromium } from 'playwright';

const CANDIDATES = [
  process.env.LVQ_CHROMIUM,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);

export const LAUNCH_ARGS = [
  // Khong co GPU trong container -> SwiftShader (software GL), ket qua on dinh giua cac lan chay.
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-lcd-text',
  '--force-color-profile=srgb',
  '--disable-dev-shm-usage',
  '--no-sandbox',
];

export async function launch(extra = {}) {
  const executablePath = CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  try {
    return await chromium.launch({ args: LAUNCH_ARGS, ...extra });
  } catch (e) {
    if (!executablePath) throw e;
    return chromium.launch({ executablePath, args: LAUNCH_ARGS, ...extra });
  }
}
