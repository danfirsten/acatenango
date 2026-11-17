/**
 * Renders the 1200x630 social cards from the real page: it serves the static
 * build in `out/` and screenshots the first screen, so the card shows the
 * actual engraved mountain rather than an illustration. One card per
 * language: public/og.png from /, public/og-es.png from /es/. Paper, with
 * motion reduced, so the clip has already opened.
 *
 * The card is timeless. Nothing regenerates it when a bulletin lands, so it
 * carries no day: the age pill, the day's sentence and figures, the image
 * tag's date and the controls are taken out, and the title and the page's
 * own description stand where the day was. The notice stays, word for word.
 *
 *   npm run build && npm run og
 *
 * Playwright's Chromium is expected at the usual place; set
 * PLAYWRIGHT_CHROMIUM to point at another binary.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

import { chromium } from 'playwright';

import { getDict, type Locale } from '../src/i18n';

const PORT = Number(process.env.OG_PORT ?? 4173);
/** The card for each language, and the page it is taken from. */
const CARDS = [
  { route: '/', locale: 'en', file: path.join(process.cwd(), 'public', 'og.png') },
  { route: '/es/', locale: 'es', file: path.join(process.cwd(), 'public', 'og-es.png') },
] satisfies { route: string; locale: Locale; file: string }[];

/** The card's height. */
const CARD_H = 630;

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
          viewport: { width: 1200, height: CARD_H },
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
          colorScheme: 'light',
        });
        await page.goto(new URL(card.route.slice(1), url).href, { waitUntil: 'networkidle' });
        // The scene is drawn once its loading state has gone; then give it a moment to settle.
        await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });
        const { meta } = getDict(card.locale);
        // "Fuego: the daily record of …" → "The daily record of …", under the wordmark.
        const heading = meta.title.replace(/^Fuego:\s*/, '');
        await page.evaluate(({ heading, description, cardH }) => {
          // Everything that names a day, or is a control, goes.
          document.querySelectorAll('.topbar > :not(.brand), .chip-tag, .massif-views, .first ~ *, .replay-bar')
            .forEach((el) => el.remove());
          const day = document.querySelector<HTMLElement>('.first-day')!;
          day.replaceChildren();
          const h = document.createElement('p');
          h.className = 'day-sentence';
          h.textContent = `${heading[0].toUpperCase()}${heading.slice(1)}.`;
          const d = document.createElement('p');
          d.className = 'readout-note';
          d.textContent = description;
          d.style.fontSize = '18px';
          d.style.marginTop = '0';
          day.append(h, d);
          // The scene ends a gutter above the card's edge, so nothing is cut.
          const scene = document.querySelector<HTMLElement>('.first-scene')!;
          const gutter = parseFloat(getComputedStyle(document.querySelector('.first')!).paddingLeft);
          scene.style.height = `${cardH - gutter - scene.getBoundingClientRect().top}px`;
        }, { heading, description: meta.description, cardH: CARD_H });
        // Let the scene redraw at its new size.
        await page.waitForTimeout(2500);
        await page.screenshot({ path: card.file, clip: { x: 0, y: 0, width: 1200, height: CARD_H } });
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
