/**
 * Renders the 1200x630 social card (public/og.png) from the real scene: it
 * serves the static build in `out/` and screenshots the page, so the card
 * shows the actual mountain rather than an illustration.
 *
 *   npm run build && npm run og
 *
 * Playwright's Chromium is expected at the usual place; set
 * PLAYWRIGHT_CHROMIUM to point at another binary.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

import { chromium } from 'playwright';

const PORT = Number(process.env.OG_PORT ?? 4173);
const OUT_FILE = path.join(process.cwd(), 'public', 'og.png');

async function waitForServer(url: string): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`static server never answered at ${url}`);
}

async function main(): Promise<void> {
  const server = spawn('npx', ['serve', 'out', '-l', String(PORT), '--no-clipboard'], {
    stdio: 'ignore',
  });
  try {
    const url = `http://localhost:${PORT}/`;
    await waitForServer(url);
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1200, height: 630 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      // Give the scene a moment to draw its first frames.
      await page.waitForTimeout(4000);
      await page.screenshot({ path: OUT_FILE, clip: { x: 0, y: 0, width: 1200, height: 630 } });
      console.log(`[og] wrote ${path.relative(process.cwd(), OUT_FILE)}`);
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error('[og] failed:', err);
  process.exitCode = 1;
});
