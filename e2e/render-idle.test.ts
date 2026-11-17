/**
 * The scene must never starve the page's main thread. With motion on, a slow
 * machine still has to be able to switch views: QA clicks "From camp" with a
 * 5 s budget, and the base went red when the render loop held the thread.
 * The test recreates that: the CPU throttled 4x and every core kept busy
 * twice over, as when QA runs beside another build.
 *
 *   npm run test:e2e   (builds out/ first)
 */

import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { type AddressInfo } from 'node:net';
import { type Server, createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
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

describe('the scene leaves the page responsive', () => {
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

  /**
   * Counts browser frames, and which of them carried a WebGL draw call. The
   * scene's own draws happen inside a frame callback, so each draw is tagged
   * with the number of the frame it fell in.
   */
  // A string, not a function: the test runner's transpiler adds helpers to
  // functions that do not exist inside the page.
  const COUNT_DRAWS = `
    window.__frame = 0;
    window.__drawFrames = new Set();
    const tick = () => { window.__frame++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
      for (const m of ['drawElements', 'drawArrays']) {
        const draw = C.prototype[m];
        C.prototype[m] = function (...args) {
          window.__drawFrames.add(window.__frame);
          return draw.apply(this, args);
        };
      }
    }
  `;

  async function open(reducedMotion: 'reduce' | 'no-preference' = 'no-preference') {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
    await ctx.addInitScript({ content: COUNT_DRAWS });
    const page: Page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 60_000 });
    return { ctx, page };
  }

  /** Browser frames and frames with a draw, over the next `ms`. */
  async function measure(page: Page, ms: number) {
    return page.evaluate((ms) => new Promise<{ frames: number; drawn: number; seconds: number }>((done) => {
      const w = window as unknown as { __frame: number; __drawFrames: Set<number> };
      const from = w.__frame;
      const t0 = performance.now();
      setTimeout(() => {
        const to = w.__frame;
        const drawn = [...w.__drawFrames].filter((f) => f > from && f <= to).length;
        done({ frames: to - from, drawn, seconds: (performance.now() - t0) / 1000 });
      }, ms);
    }), ms);
  }

  it('leaves most browser frames free of WebGL work when drawing is slow', async () => {
    const { ctx, page } = await open();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.waitForTimeout(1500);
    const m = await measure(page, 4000);
    // A loop that draws in every frame leaves none for scrolling and clicks.
    assert.ok(m.frames >= 4, `the page kept producing frames (${m.frames})`);
    assert.ok(m.drawn > 0, 'the scene still animates');
    assert.ok(m.drawn <= m.frames / 2, `draws in ${m.drawn} of ${m.frames} frames`);
    await ctx.close();
  });

  it('draws at most 30 frames a second', async () => {
    const { ctx, page } = await open();
    await page.waitForTimeout(1500);
    const m = await measure(page, 3000);
    assert.ok(m.drawn / m.seconds <= 31, `${(m.drawn / m.seconds).toFixed(1)} drawn frames a second`);
    await ctx.close();
  });

  it('stops drawing while the scene is scrolled out of view, and starts again', async () => {
    const { ctx, page } = await open();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    const away = await measure(page, 2000);
    assert.equal(away.drawn, 0, `no draws while out of view (${away.drawn} of ${away.frames} frames)`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    const back = await measure(page, 2000);
    assert.ok(back.drawn > 0, 'drawing resumed in view');
    await ctx.close();
  });

  it('switches views ten times in a row at 1440 with motion on, the CPU throttled 4x and every core busy', async () => {
    // A busy machine: two spinning processes per core, for the length of the test.
    const hogs = [...os.cpus(), ...os.cpus()].map(() => spawn(process.execPath, ['-e', 'for (;;) {}'], { stdio: 'ignore' }));
    try {
      const { ctx, page } = await open();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.waitForTimeout(3000);
      const views = page.locator('.massif-views button');
      for (let i = 0; i < 10; i++) {
        const target = views.nth(i % 2 === 0 ? 1 : 0);
        // From the top of the page each time: the switch sits below the
        // first screen, so the click has to scroll to it, as QA's does.
        await page.evaluate(() => window.scrollTo(0, 0));
        // The same budget QA gives an interaction.
        await target.click({ timeout: 5000 });
        assert.equal(await target.getAttribute('aria-pressed'), 'true', `click ${i + 1} switched the view`);
      }
      await ctx.close();
    } finally {
      for (const h of hogs) h.kill();
    }
  });

  it('still holds still with reduced motion, and wakes for a change', async () => {
    const { ctx, page } = await open('reduce');
    // The camera settles first; then the scene must stop drawing altogether.
    let idle = await measure(page, 2000);
    for (let i = 0; i < 15 && idle.drawn > 0; i++) idle = await measure(page, 2000);
    assert.equal(idle.drawn, 0, `no draws once settled (${idle.drawn} of ${idle.frames} frames)`);
    await page.locator('.massif-views button').nth(1).click();
    const woke = await measure(page, 1500);
    assert.ok(woke.drawn > 0, 'a view switch draws again');
    await ctx.close();
  });
});
