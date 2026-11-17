/**
 * Motion (#38): the clip opens once, reduced motion gets final states, the scrub
 * fades and glides, and a saved copy shows the sleeping Hoop.
 *
 *   npm run test:e2e   (builds out/ first)
 */

import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { type AddressInfo } from 'node:net';
import { type Server, createServer } from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { type Browser, type Page, chromium } from 'playwright';

const BASE = '/acatenango';
const OUT = path.join(process.cwd(), 'out');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

async function isFile(p: string): Promise<boolean> {
  try { return (await stat(p)).isFile(); } catch { return false; }
}

function server(): Server {
  return createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const rel = decodeURIComponent(pathname.startsWith(BASE) ? pathname.slice(BASE.length) : '/missing');
    const file = path.join(OUT, rel);
    for (const c of rel.endsWith('/') ? [path.join(file, 'index.html')] : [file, `${file}.html`]) {
      if (c.startsWith(OUT) && (await isFile(c))) {
        res.writeHead(200, { 'content-type': TYPES[path.extname(c)] ?? 'application/octet-stream' });
        res.end(await readFile(c));
        return;
      }
    }
    res.writeHead(404).end();
  });
}

describe('motion: the moment, the scrub and the sleeping Hoop', () => {
  let srv: Server;
  let browser: Browser;
  let origin: string;

  before(async () => {
    srv = server();
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    origin = `http://127.0.0.1:${(srv.address() as AddressInfo).port}${BASE}`;
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
  });
  after(async () => {
    await browser?.close();
    await new Promise((r) => srv?.close(r));
  });

  const ready = async (page: Page, path = '/') => {
    await page.goto(`${origin}${path}`, { waitUntil: 'load' });
    await page.locator('.massif').waitFor();
  };

  it('opens the clip once per visit, on the system\'s curves', async () => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await ready(page);
    await page.locator('.massif[data-clip="play"]').waitFor();
    const names = await page.evaluate(() => {
      const stage = document.querySelector('.massif-stage') as HTMLElement;
      const canvas = stage.querySelector('canvas') as HTMLElement;
      return [getComputedStyle(stage).animationName, getComputedStyle(stage).animationDuration,
        getComputedStyle(canvas).animationName, getComputedStyle(canvas).animationDuration];
    });
    assert.deepEqual(names, ['clip-open', '1.2s', 'scene-settle', '1.6s']);
    // Reloading in the same visit: no second clip.
    await page.reload({ waitUntil: 'load' });
    await page.locator('.massif').waitFor();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.massif[data-clip]').count(), 0, 'the clip plays once per visit');
    await ctx.close();
  });

  it('with reduced motion shows final states: no clip, no settle, no glide, no drawer', async () => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await ready(page);
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.massif[data-clip]').count(), 0);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.massif-stage')!).animationName), 'none');
    await page.locator('#record-scrub').focus();
    await page.keyboard.press('ArrowLeft');
    await page.locator('.replay-bar').waitFor();
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.replay-bar')!).animationName), 'none');
    // The system's reduced-motion rule leaves 0.01 ms at most: no glide.
    const glide = await page.evaluate(() => getComputedStyle(document.querySelector('.tempo-hoop')!).transitionDuration);
    assert.ok(parseFloat(glide) < 0.001, `Hoop does not glide (${glide})`);
    await ctx.close();
  });

  it('scrubbing: figures fade in place, Hoop glides, the replay bar is a drawer that closes', async () => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await ready(page);
    assert.equal(await page.locator('.first').getAttribute('data-swap'), 'false', 'nothing swaps on load');
    assert.equal(await page.locator('.replay-bar').count(), 0);
    const hoop = page.locator('.tempo-hoop');
    assert.equal(await hoop.evaluate((el) => getComputedStyle(el).transitionDuration), '0.22s');
    await page.locator('#record-scrub').focus();
    await page.keyboard.press('ArrowLeft');
    await page.locator('.replay-bar[data-open="true"]').waitFor();
    assert.equal(await page.locator('.first').getAttribute('data-swap'), 'true');
    assert.equal(await page.locator('.readout-v').first().evaluate((el) => getComputedStyle(el).animationName), 'swap-in');
    assert.equal(await page.locator('.replay-bar').evaluate((el) => getComputedStyle(el).animationName), 'drawer-up');
    await page.locator('.replay-bar .pill-solid').click();
    await page.locator('.replay-bar[data-open="false"]').waitFor();
    await page.locator('.replay-bar').waitFor({ state: 'detached' });
    await ctx.close();
  });

  it('a saved copy shows the chip with Hoop asleep, in both languages', async () => {
    for (const [path, chip] of [['/', /^Offline · saved copy · /], ['/es/', /^Sin conexión · copia guardada · /]] as const) {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await ready(page, path);
      assert.equal(await page.locator('.offline-chip').count(), 0, 'no chip while online');
      await ctx.setOffline(true);
      const chipEl = page.locator('.offline-chip');
      await chipEl.waitFor();
      assert.match((await chipEl.innerText()).trim(), chip);
      assert.equal(await chipEl.locator('.hoop').getAttribute('data-state'), 'asleep');
      await ctx.setOffline(false);
      await chipEl.waitFor({ state: 'detached' });
      await ctx.close();
    }
  });
});
