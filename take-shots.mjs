// take-shots.mjs — browser check for MIDNIGHT VAULT.
// Serves game/ on localhost, opens each ?shot= pose in headless Chromium at
// 1280x800, records every console error / page error, and saves the shots as
// JPEGs under screenshots/. Exits non-zero if any console error appeared.
//
// Usage: node take-shots.mjs

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8947;
const SHOTS = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

const server = spawn('node', [join(here, 'serve.ts'), String(PORT)], {
  cwd: here,
  stdio: 'pipe',
});
await new Promise((resolve) => setTimeout(resolve, 1500));

const errors = [];
let browser;
try {
  browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${String(err).slice(0, 400)}`));
  page.on('requestfailed', (req) => errors.push(`request failed: ${req.url()} ${req.failure()?.errorText}`));

  for (const shot of SHOTS) {
    const url = `http://127.0.0.1:${PORT}/${shot.query}`;
    console.log('opening', url);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: join(here, 'screenshots', shot.name),
      type: 'jpeg',
      quality: 88,
    });
    console.log('saved', shot.name);
  }

  // Also load the plain title screen once, to prove the game boots with no shot param.
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const title = await page.evaluate(() => document.title);
  console.log('title page OK:', title);
} finally {
  if (browser) await browser.close();
  server.kill();
}

if (errors.length > 0) {
  console.log(`\n${errors.length} browser error(s):`);
  for (const e of errors) console.log(' ', e);
  process.exit(1);
}
console.log('\nbrowser check: 0 console errors');
