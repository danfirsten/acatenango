/**
 * The phone layout: both summits in frame, the readout clear of the scene, no
 * text under 11 px, and a still scene with reduced motion.
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

describe('phone layout', () => {
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

  async function open(width: number, height: number, reducedMotion = false, path = ''): Promise<Page> {
    const ctx = await browser.newContext({
      viewport: { width, height },
      reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    });
    const page = await ctx.newPage();
    await page.goto(url + path, { waitUntil: 'load' });
    await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });
    return page;
  }

  /** Which summit dots are visible, and where. Waits for the camera to settle. */
  async function summitBoxes(page: Page) {
    // The camera glides in; software WebGL is slow, so give it time to arrive.
    await page.waitForTimeout(9000);
    return page.evaluate(() =>
      [...document.querySelectorAll('.summit')].map((el) => {
        const dot = el.querySelector('.summit-dot')!.getBoundingClientRect();
        const text = el.querySelector('.summit-text')!.getBoundingClientRect();
        const hero = document.querySelector('.hero')!.getBoundingClientRect();
        const readout = document.querySelector('.readout')!.getBoundingClientRect();
        return {
          name: el.querySelector('b')!.textContent,
          shown: getComputedStyle(el).opacity === '1',
          left: Math.min(dot.left, text.left), right: text.right,
          top: dot.top, bottom: dot.bottom,
          heroTop: hero.top, readoutTop: readout.top, vw: innerWidth,
        };
      }));
  }

  for (const [w, h] of [[390, 844], [768, 1024]] as const) {
    it(`frames both summits clear of the readout at ${w}x${h}`, async () => {
      const page = await open(w, h);
      const boxes = await summitBoxes(page);
      assert.equal(boxes.length, 2);
      for (const b of boxes) {
        assert.ok(b.shown, `${b.name} is shown`);
        assert.ok(b.left >= 0 && b.right <= b.vw, `${b.name} label inside the viewport (${b.left}..${b.right})`);
        assert.ok(b.bottom < b.readoutTop, `${b.name} sits above the readout`);
      }
      await page.context().close();
    });

    for (const path of ['', 'es/']) {
      it(`keeps the topbar clear of the summit labels at ${w}x${h} on /${path}`, async () => {
        const page = await open(w, h, false, path);
        const boxes = await summitBoxes(page);
        const bar = await page.evaluate(() => {
          const range = document.createRange();
          range.selectNodeContents(document.querySelector('.observed')!);
          return [document.querySelector('.topbar .lang-switch')!.getBoundingClientRect(), ...range.getClientRects()]
            .map((b) => ({ left: b.left, right: b.right, top: b.top, bottom: b.bottom }));
        });
        assert.ok(bar[0].bottom - bar[0].top >= 44, `the switch is a 44 px tap target (${bar[0].bottom - bar[0].top})`);
        for (const b of boxes) {
          assert.ok(b.left >= 0 && b.right <= b.vw, `${b.name} label inside the viewport (${b.left}..${b.right})`);
          const label = { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
          for (const t of bar) {
            const hit = t.left < label.right && label.left < t.right && t.top < label.bottom && label.top < t.bottom;
            assert.ok(!hit, `${b.name} label is clear of the topbar (${JSON.stringify(t)} vs ${JSON.stringify(label)})`);
          }
        }
        await page.context().close();
      });
    }

    it(`frames Fuego from camp at ${w}x${h}`, async () => {
      const page = await open(w, h);
      await page.getByRole('button', { name: 'From camp' }).click();
      const fuego = (await summitBoxes(page)).find((b) => b.name === 'Fuego')!;
      assert.ok(fuego.shown, 'Fuego is shown');
      assert.ok(fuego.left >= 0 && fuego.right <= fuego.vw, 'Fuego label inside the viewport');
      assert.ok(fuego.bottom < fuego.readoutTop, 'Fuego above the readout');
      await page.context().close();
    });

    it(`has no text under 11px at ${w}x${h}`, async () => {
      const page = await open(w, h);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || !n.textContent?.trim() || el.closest('script,style,noscript')) continue;
          const svg = el.closest('svg');
          let px = parseFloat(getComputedStyle(el).fontSize);
          // SVG text is scaled by the viewBox: measure what the eye sees.
          if (svg) {
            const vb = svg.viewBox.baseVal;
            px *= svg.getBoundingClientRect().width / vb.width;
          }
          if (px < 11 - 0.01) out.push(`${n.textContent.trim().slice(0, 30)} ${px.toFixed(1)}px`);
        }
        return out;
      });
      assert.deepEqual(small, []);
      await page.context().close();
    });
  }

  it('keeps the record legible at 390 wide: a short chart, roomy lanes, the drift lane marking camp', async () => {
    const page = await open(390, 844, true);
    // No named helpers in here: the test runner's transform would rename them.
    const m = await page.evaluate(() => {
      return {
        chart: document.querySelector('.tempo svg')!.getBoundingClientRect().height,
        lanes: [...document.querySelectorAll('.lane svg')].map((l) => l.getBoundingClientRect().height),
        plot: document.querySelector('.lanes-plot')!.getBoundingClientRect().height,
        camp: document.querySelectorAll('.lane[data-lane="compass"] .lane-camp').length,
        campTick: document.querySelector('.lane[data-lane="compass"] .lane-tick[data-camp]')?.textContent,
      };
    });
    assert.ok(m.chart <= 160, `a shorter chart on a phone (${m.chart})`);
    assert.ok(m.lanes.length >= 4);
    for (const h of m.lanes) assert.ok(h >= 20, `each lane keeps its height (${h})`);
    assert.ok(m.plot >= 44, 'the lanes are a target of at least 44 px');
    assert.equal(m.camp, 1, 'camp’s bearing is marked on the drift lane');
    assert.equal(m.campTick, 'N');
    await page.context().close();
  });

  it('shows the three figures with no empty cell at 390 wide', async () => {
    const page = await open(390, 844);
    const cells = await page.evaluate(() =>
      [...document.querySelectorAll('.figures > div')].map((d) => ({
        height: d.getBoundingClientRect().height,
        dd: [...d.querySelectorAll('dd')].map((x) => x.textContent?.trim() ?? ''),
        // The last child must reach the bottom of the cell: no blank row under it.
        slack: d.getBoundingClientRect().bottom - d.lastElementChild!.getBoundingClientRect().bottom,
      })));
    assert.equal(cells.length, 3);
    for (const c of cells) {
      assert.ok(c.dd.every((t) => t !== ''), 'every value is filled');
      assert.ok(c.slack <= 16, `no blank row in the cell (slack ${c.slack})`);
    }
    await page.context().close();
  });

  it('holds the scene still with reduced motion', async () => {
    const page = await open(390, 844, true);
    const shot = async () => page.locator('.massif-canvas').screenshot();
    await page.waitForTimeout(20_000);
    const a = await shot();
    await page.waitForTimeout(2500);
    const b = await shot();
    assert.ok(a.equals(b), 'two frames seconds apart are identical');
    await page.context().close();
  });
});
