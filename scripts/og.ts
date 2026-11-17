/**
 * Renders the 1200x630 social cards from the real page: it serves the static
 * build in `out/` and screenshots the first screen, so the card shows the
 * actual engraved mountain and the day's sentence rather than an illustration.
 * One card per language: public/og.png from /, public/og-es.png from /es/.
 * Paper, with motion reduced, so the clip has already opened.
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
/** The card for each language, and the page it is taken from. */
const CARDS = [
  { route: '/', file: path.join(process.cwd(), 'public', 'og.png') },
  { route: '/es/', file: path.join(process.cwd(), 'public', 'og-es.png') },
];

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
      for (const card of CARDS) {
        const page = await browser.newPage({
          viewport: { width: 1200, height: 630 },
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
          colorScheme: 'light',
        });
        await page.goto(new URL(card.route.slice(1), url).href, { waitUntil: 'networkidle' });
        // The scene is drawn once its loading state has gone; then give it a moment to settle.
        await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: card.file, clip: { x: 0, y: 0, width: 1200, height: 630 } });
        console.log(`[og] wrote ${path.relative(process.cwd(), card.file)}`);
        await page.close();
      }
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
