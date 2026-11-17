/**
 * The phone layout and the first screen: the notice strip, the top row, the
 * scene in its clip with both summits in frame, the day's sentence and three
 * figures all on the first screen in both languages, the age pill, the two
 * columns on wider screens, no text under 11 px, and a still scene with
 * reduced motion.
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

import type { FuegoIndex } from '../scripts/build-index';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { describeCamp } from '../src/lib/camp';

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
  let index: FuegoIndex;

  before(async () => {
    index = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'index.json'), 'utf8')) as FuegoIndex;
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

  async function open(width: number, height: number, reducedMotion = false, path = '', now?: Date): Promise<Page> {
    const ctx = await browser.newContext({
      viewport: { width, height },
      reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    });
    const page = await ctx.newPage();
    if (now) await page.clock.setFixedTime(now);
    await page.goto(url + path, { waitUntil: 'load' });
    await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });
    return page;
  }

  /** Where the summit labels are, once the named ones are shown. */
  async function summitBoxes(page: Page, want = ['Fuego', 'Acatenango']) {
    // The camera glides in and software WebGL is slow: wait until the labels are up.
    await page.waitForFunction((names) => names.every((n) => [...document.querySelectorAll('.summit')]
      .some((el) => el.querySelector('b')?.textContent === n && getComputedStyle(el).opacity === '1')), want, { timeout: 45_000 });
    // Then let a glide in progress finish.
    await page.waitForTimeout(3000);
    return page.evaluate(() =>
      [...document.querySelectorAll('.summit')].map((el) => {
        const dot = el.querySelector('.summit-dot')!.getBoundingClientRect();
        const text = el.querySelector('.summit-text')!.getBoundingClientRect();
        const scene = document.querySelector('.first-scene')!.getBoundingClientRect();
        return {
          name: el.querySelector('b')!.textContent,
          shown: getComputedStyle(el).opacity === '1',
          left: Math.min(dot.left, text.left), right: Math.max(dot.right, text.right),
          top: Math.min(dot.top, text.top), bottom: Math.max(dot.bottom, text.bottom),
          words: { left: text.left, right: text.right, top: text.top, bottom: text.bottom },
          dot: { left: dot.left, right: dot.right, top: dot.top, bottom: dot.bottom },
          scene: { left: scene.left, right: scene.right, top: scene.top, bottom: scene.bottom },
        };
      }));
  }

  for (const [w, h] of [[390, 844], [768, 1024]] as const) {
    it(`frames both summits inside the scene, clear of each other, at ${w}x${h}`, async () => {
      for (const route of ['', 'es/']) {
        const page = await open(w, h, false, route);
        const boxes = await summitBoxes(page);
        assert.equal(boxes.length, 2);
        for (const b of boxes) {
          assert.ok(b.shown, `${b.name} is shown`);
          assert.ok(b.left >= b.scene.left && b.right <= b.scene.right, `${b.name} label inside the scene (${JSON.stringify(b)})`);
          assert.ok(b.top >= b.scene.top && b.bottom <= b.scene.bottom, `${b.name} label inside the scene (${b.top}..${b.bottom})`);
        }
        const [a, c] = boxes;
        type R = { left: number; right: number; top: number; bottom: number };
        const hit = (p: R, q: R) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
        // Neither label's words sit on the other's words or on the other summit's dot.
        for (const [p, q] of [[a.words, c.words], [a.words, c.dot], [c.words, a.dot]]) {
          assert.ok(!hit(p, q), `the two summit labels do not print over each other on /${route} (${JSON.stringify(boxes)})`);
        }
        await page.context().close();
      }
    });

    it(`frames Fuego from camp at ${w}x${h}`, async () => {
      const page = await open(w, h);
      await page.getByRole('button', { name: 'From camp' }).click();
      const fuego = (await summitBoxes(page, ['Fuego'])).find((b) => b.name === 'Fuego')!;
      assert.ok(fuego.shown, 'Fuego is shown');
      // You stand on Acatenango in this view, so it carries no label.
      assert.ok(!(await summitBoxes(page, ['Fuego'])).some((b) => b.name === 'Acatenango' && b.shown), 'camp is not labelled from camp');
      assert.ok(fuego.left >= fuego.scene.left && fuego.right <= fuego.scene.right, `Fuego label inside the scene (${JSON.stringify(fuego)})`);
      // Its words stay clear of the image tag and the switch along the bottom.
      const controls = await page.evaluate(() => [...document.querySelectorAll('.first-scene .chip-tag, .massif-views button')]
        .map((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
      // Every label shown, Fuego's or another, sits inside the clip and clear of the scene's controls.
      for (const b of (await summitBoxes(page, ['Fuego'])).filter((x) => x.shown)) {
        const words = b.words;
        assert.ok(words.top >= b.scene.top && words.bottom <= b.scene.bottom, `${b.name}'s words inside the clip (${JSON.stringify(b)})`);
        for (const c of controls) {
          const hit = words.left < c.right && c.left < words.right && words.top < c.bottom && c.top < words.bottom;
          assert.ok(!hit, `${b.name}'s words are clear of the scene's controls (${JSON.stringify(words)} vs ${JSON.stringify(c)})`);
        }
      }
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

  /** Where each part of the first screen sits. No named helpers in the page: the test runner's transform would rename them. */
  async function firstScreen(page: Page) {
    type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
    type Part = 'notice' | 'topbar' | 'brand' | 'age' | 'scene' | 'tag' | 'view' | 'sentence' | 'figures' | 'record' | 'day';
    const boxes = (await page.evaluate((sels) => Object.fromEntries(Object.entries(sels).map(([k, sel]) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return [k, { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }];
    })), {
      notice: '#notice', topbar: '.topbar', brand: '.brand', age: '.observed-date', scene: '.first-scene',
      tag: '.first-scene .chip-tag', view: '.first-scene .massif-views button', sentence: '.day-sentence',
      figures: '.first .readout', record: '.first-day > a[href="#record"]', day: '.first-day',
    } satisfies Record<Part, string>)) as Record<Part, Box>;
    const rest = await page.evaluate(() => {
      const record = document.querySelector('.first-day > a[href="#record"]') as HTMLElement;
      return {
        vh: innerHeight,
        officials: [...document.querySelectorAll('#notice a')].map((a) => ({
          text: (a as HTMLElement).textContent!.replace(/\s+/g, ' ').trim(), height: a.getBoundingClientRect().height })),
        radius: getComputedStyle(document.querySelector('.first-scene')!).borderTopLeftRadius,
        hoop: document.querySelectorAll('.first-scene .massif-views button .hoop').length,
        sentenceText: (document.querySelector('.day-sentence') as HTMLElement).innerText.trim(),
        figureKeys: [...document.querySelectorAll('.first .readout-k')].map((k) => (k as HTMLElement).innerText.trim()),
        rule: getComputedStyle(document.querySelector('.first .readout')!).borderTopColor,
        ink: getComputedStyle(document.body).color,
        recordText: record.innerText.trim(),
        recordBg: getComputedStyle(record).backgroundColor,
      };
    });
    return { ...boxes, ...rest };
  }

  for (const [route, dict] of [['', en], ['es/', es]] as const) {
    it(`puts the day's sentence and three figures on the first screen at 390x844 on /${route}`, async () => {
      const page = await open(390, 844, true, route);
      const f = await firstScreen(page);
      const latest = index.entries.at(-1)!;

      // The compact notice strip, with its two 44 px official links.
      assert.ok(f.notice.top >= 0 && f.notice.height <= 170, `a compact strip (${f.notice.height} px)`);
      assert.deepEqual(f.officials.map((o) => o.text), ['INSIVUMEH↗', 'CONRED↗']);
      for (const o of f.officials) assert.ok(o.height >= 44, `${o.text} is a 44 px target (${o.height})`);

      // In order, top to bottom: notice, top row, scene, sentence, figures, record.
      assert.ok(f.notice.bottom <= f.topbar.top + 1, 'the top row comes after the notice');
      assert.ok(Math.abs(f.brand.top + f.brand.height / 2 - (f.age.top + f.age.height / 2)) < 8, 'the age pill shares the wordmark\'s row');
      assert.ok(f.topbar.bottom <= f.scene.top + 1, 'the scene comes after the top row');
      assert.ok(f.scene.bottom < f.sentence.top, 'the sentence comes after the scene');
      assert.ok(f.sentence.bottom <= f.figures.top, 'the figures come after the sentence');
      assert.ok(f.figures.bottom <= f.record.top, 'the record pill comes after the figures');

      // The scene: a 20 px clip about 250 px tall, its tag bottom-left and Hoop's switch bottom-right inside it.
      assert.ok(f.scene.height >= 240 && f.scene.height <= 260, `about 250 px tall (${f.scene.height})`);
      assert.equal(f.radius, '20px');
      assert.ok(f.tag.left - f.scene.left <= 16 && f.scene.bottom - f.tag.bottom <= 16, 'the image tag sits bottom-left');
      assert.ok(f.scene.right - f.view.right <= 16 && f.scene.bottom - f.view.bottom <= 16, 'the switch sits bottom-right');
      assert.ok(f.tag.right <= f.view.left, `the tag and the switch do not touch (${f.tag.right} vs ${f.view.left})`);
      assert.ok(f.view.height >= 44, `the switch is a 44 px target (${f.view.height})`);
      assert.equal(f.hoop, 1, 'Hoop is on the switch');

      // The sentence is the camp panel's own, and it and the figures are fully on the first screen.
      assert.equal(f.sentenceText, describeCamp(latest, dict).summary);
      assert.deepEqual(f.figureKeys, [dict.readout.explosions, dict.readout.ashColumn, dict.readout.drift]);
      assert.equal(f.rule, f.ink, 'the figures sit under an ink rule');
      assert.ok(f.sentence.bottom <= f.vh && f.figures.bottom <= f.vh, `sentence and figures in the first screen (${f.figures.bottom} of ${f.vh})`);

      // A solid ink pill to the record, with the number of days computed.
      assert.equal(f.recordText, dict.first.seeRecord(index.entries.length));
      assert.equal(f.recordBg, f.ink, 'the record pill is solid ink');
      assert.ok(f.record.height >= 48);
      await page.context().close();
    });
  }

  for (const [w, h] of [[768, 1024], [1440, 900]] as const) {
    it(`runs the same order in two columns at ${w}x${h}`, async () => {
      const page = await open(w, h, true);
      const f = await firstScreen(page);
      assert.ok(f.topbar.bottom <= f.scene.top + 1 && f.topbar.bottom <= f.day.top + 1, 'the top row spans both columns');
      assert.ok(f.scene.right <= f.day.left, 'the scene on the left, the words on the right');
      assert.ok(f.scene.width > f.day.width, `the scene is the larger column (${f.scene.width} vs ${f.day.width})`);
      assert.ok(Math.abs(f.scene.top - f.sentence.top) < 24, 'the sentence starts level with the scene');
      assert.ok(f.sentence.bottom < f.figures.top && f.figures.bottom <= f.record.top, 'sentence, figures, record');
      assert.ok(f.figures.bottom <= f.vh, 'the figures are on the first screen');
      // The camp panel follows them in the right-hand column.
      const camp = await page.locator('.first-day .camp').boundingBox();
      assert.ok(camp && camp.x >= f.day.left - 1 && camp.y >= f.record.bottom, 'the camp panel is in the words\' column');
      await page.context().close();
    });
  }

  it('says the age as a pill: today, yesterday, then N days old with a dashed edge', async () => {
    const latest = index.entries.at(-1)!.date;
    // Noon in Guatemala, N days after the latest bulletin.
    const at = (days: number) => new Date(Date.parse(`${latest}T18:00:00Z`) + days * 86_400_000);
    const short = (iso: string, locale: string) => new Intl.DateTimeFormat(locale === 'es' ? 'es-GT' : 'en-GB',
      { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
    for (const [days, route, dict] of [[0, '', en], [1, '', en], [1, 'es/', es], [4, '', en], [4, 'es/', es]] as const) {
      const page = await open(390, 844, true, route, at(days));
      const pill = page.locator('.observed-date');
      await page.waitForFunction(() => document.querySelector('.observed-date')!.textContent!.includes('·'));
      assert.equal((await pill.innerText()).trim(), `${short(latest, dict.locale)} · ${dict.age.label(days)}`);
      const behind = days > 2;
      assert.equal(await pill.evaluate((el) => getComputedStyle(el).borderTopStyle), behind ? 'dashed' : 'solid');
      assert.equal(await page.locator('.age-behind').count(), behind ? 1 : 0);
      if (behind) assert.equal((await page.locator('.age-behind').innerText()).trim(), dict.age.behindNote);
      await page.context().close();
    }
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
