/**
 * The engraved scene follows the page's theme: paper by day, ink after dark,
 * live as the system setting or data-theme changes, with no reload. The sky is
 * the page's own background, and the summit labels use the mono label style.
 *
 *   npm run test:e2e   (builds out/ first)
 *
 * Set PLAYWRIGHT_CHROMIUM to use a Chromium other than Playwright's own.
 */

import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { type AddressInfo } from 'node:net';
import { type Server, createServer } from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { type Browser, type Page, chromium } from 'playwright';
import { PNG } from 'pngjs';

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

/** The tokens' paper and ink, which the sky must match when the page has no --bg of its own. */
const PAPER = [0xf7, 0xf7, 0xf4];
const INK = [0x0b, 0x0b, 0x0b];

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

describe('the engraved scene', () => {
  let srv: Server;
  let browser: Browser;
  let url: string;

  before(async () => {
    srv = server();
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}${BASE}/`;
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
  });
  after(async () => {
    await browser?.close();
    await new Promise((r) => srv?.close(r));
  });

  async function open(colorScheme: 'light' | 'dark'): Promise<Page> {
    // Reduced motion: the scene holds still and draws only on a change, so a
    // theme change that reaches the canvas proves the idle render still wakes.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });
    await page.waitForTimeout(3000);
    return page;
  }

  /** The page's --bg if it has one, else the token the scene falls back to. */
  async function expectedSky(page: Page, fallback: number[]): Promise<number[]> {
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    const hex = /^#([0-9a-f]{6})$/i.exec(bg);
    return hex ? [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) : fallback;
  }

  /** A patch of open sky at the left of the scene, clear of the readout and labels. */
  async function sky(page: Page): Promise<number[]> {
    const png = PNG.sync.read(await page.screenshot({ clip: { x: 12, y: 300, width: 4, height: 4 } }));
    return [png.data[0], png.data[1], png.data[2]];
  }

  async function settlesTo(page: Page, want: number[], label: string) {
    let got: number[] = [];
    for (let i = 0; i < 20; i++) {
      got = await sky(page);
      if (got.every((c, k) => Math.abs(c - want[k]) <= 3)) return;
      await page.waitForTimeout(500);
    }
    assert.fail(`${label}: sky is rgb(${got}), expected rgb(${want})`);
  }

  it('draws on paper in a light system and on ink in a dark one', async () => {
    const light = await open('light');
    await settlesTo(light, await expectedSky(light, PAPER), 'light system');
    await light.context().close();

    const dark = await open('dark');
    await settlesTo(dark, await expectedSky(dark, INK), 'dark system');
    await dark.context().close();
  });

  it('follows the theme live, with no reload', async () => {
    const page = await open('light');
    await page.evaluate(() => { (window as unknown as { marker: number }).marker = 1; });

    await page.emulateMedia({ colorScheme: 'dark' });
    await settlesTo(page, await expectedSky(page, INK), 'system turned dark');

    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    await settlesTo(page, await expectedSky(page, PAPER), 'data-theme="light"');

    await page.evaluate(() => { document.documentElement.dataset.theme = 'auto'; });
    await settlesTo(page, await expectedSky(page, INK), 'back to auto');

    assert.equal(await page.evaluate(() => (window as unknown as { marker?: number }).marker), 1, 'the page did not reload');
    await page.context().close();
  });

  it('sets the summit labels in the mono label style', async () => {
    const page = await open('light');
    const fonts = await page.evaluate(() =>
      [...document.querySelectorAll('.summit-text b, .summit-text i')].map((el) => {
        const s = getComputedStyle(el);
        return { family: s.fontFamily, size: parseFloat(s.fontSize), transform: s.textTransform };
      }));
    assert.ok(fonts.length >= 4, 'both summits have a name and a line under it');
    for (const f of fonts) {
      assert.match(f.family, /Geist Mono|monospace/i);
      assert.ok(f.size >= 11, `no label under 11 px (${f.size})`);
      assert.equal(f.transform, 'none', 'sentence case inside the app');
    }
    await page.context().close();
  });
});
