/**
 * The launch checks, on the GitHub Pages build served from its subfolder:
 * missing days are never drawn or read as zero, the notice is in view, no
 * serious accessibility issue in either language or on the 404, the scene and
 * the record work from the keyboard in a sensible order, the camp panel follows
 * the selected day, and a reader who chose Spanish never sees the English page.
 *
 *   npm run test:e2e   (builds out/ with PAGES_BASE_PATH=/acatenango first)
 *
 * Set PLAYWRIGHT_CHROMIUM to use a Chromium other than Playwright's own.
 */

import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { type AddressInfo } from 'node:net';
import { type Server, createServer } from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { type Browser, type Page, chromium } from 'playwright';

import type { FuegoIndex } from '../scripts/build-index';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { PLOT_GUTTER } from '../src/lib/readout';

const BASE = '/acatenango';
const OUT = path.join(process.cwd(), 'out');
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function isFile(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

/** Serves out/ under BASE as GitHub Pages does, 404.html included. */
function pagesServer(): Server {
  return createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const rel = pathname.startsWith(`${BASE}/`) ? decodeURIComponent(pathname.slice(BASE.length)) : null;
    const file = rel === null ? null : path.join(OUT, rel);
    if (file !== null && rel !== null && file.startsWith(OUT)) {
      for (const c of rel.endsWith('/') ? [path.join(file, 'index.html')] : [file, `${file}.html`]) {
        if (await isFile(c)) {
          res.writeHead(200, { 'content-type': TYPES[path.extname(c)] ?? 'application/octet-stream' });
          res.end(await readFile(c));
          return;
        }
      }
    }
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    res.end(await readFile(path.join(OUT, '404.html')));
  });
}

type Violation = { id: string; impact: string | null; nodes: { target: string[] }[] };

/** Runs axe-core on the page: WCAG 2.1 A and AA, as the QA run does. */
async function seriousViolations(page: Page, axeSource: string): Promise<string[]> {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (o: unknown) => Promise<{ violations: Violation[] }> } }).axe;
    const r = await axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return r.violations;
  });
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

describe('launch checks', () => {
  let server: Server;
  let browser: Browser;
  let origin: string;
  let axeSource: string;
  let index: FuegoIndex;

  before(async () => {
    assert.ok(await isFile(path.join(OUT, '404.html')), 'out/ is not built: run `npm run test:e2e`, which builds first');
    axeSource = await readFile(AXE, 'utf8');
    index = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'index.json'), 'utf8')) as FuegoIndex;
    server = pagesServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
  });

  after(async () => {
    await browser?.close();
    await new Promise((resolve) => server?.close(resolve));
  });

  async function open(route: string, width = 1440, height = 900): Promise<Page> {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(`${origin}${BASE}${route}`, { waitUntil: 'load' });
    await page.locator('.brand').first().waitFor();
    return page;
  }

  async function ready(page: Page): Promise<void> {
    await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });
  }

  const selectedDay = (page: Page) => page.locator('[data-selected-day]').getAttribute('data-selected-day');

  it('never draws or reads a missing day as zero', async () => {
    const entries = index.entries;
    const missing = entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.explosionsMax === null && !e.phenomena.includes('continuousPhase'));
    assert.ok(missing.length > 0, 'the record has days with no rate to check against');

    const page = await open('/');
    await ready(page);

    // Every rate-less day sits inside a hatched gap band and under no line.
    const chart = await page.evaluate((days) => {
      const svg = document.querySelector<SVGSVGElement>('.tempo svg')!;
      const n = days.total;
      const w = svg.viewBox.baseVal.width - days.gutter;
      const bands = [...svg.querySelectorAll<SVGRectElement>('.tempo-gap')].map((r) => r.getBBox());
      const lines = [...svg.querySelectorAll<SVGPathElement>('.tempo-line')].map((p) => p.getBBox());
      // No named helpers in here: the test runner's transform would rename them.
      return days.missing.map((i) => {
        const x = days.gutter + (n > 1 ? (i * w) / (n - 1) : w / 2);
        return {
          i,
          inGap: bands.some((b) => b.x <= x && x <= b.x + b.width),
          underLine: lines.some((b) => b.x < x && x < b.x + b.width),
        };
      });
    }, { total: entries.length, missing: missing.map((m) => m.i), gutter: PLOT_GUTTER });
    for (const c of chart) {
      assert.ok(c.inGap, `${entries[c.i].date} is drawn as a gap`);
      assert.ok(!c.underLine, `no line is drawn across ${entries[c.i].date}`);
    }

    // Scrub to the latest rate-less day from the keyboard: nothing says 0.
    const target = missing.at(-1)!;
    await page.locator('.tempo-plot').focus();
    await page.keyboard.press('End');
    for (let k = entries.length - 1; k > target.i; k--) await page.keyboard.press('ArrowLeft');
    assert.equal(await selectedDay(page), target.e.date);
    // Hoop rests on the band, and the lens holds no bold line: there is none to draw.
    assert.equal(await page.locator('.tempo-selected').getAttribute('data-state'), 'notReported');
    assert.ok(await page.evaluate(() => {
      const hoop = document.querySelector('.tempo-hoop')!.getBoundingClientRect();
      const x = hoop.left + hoop.width / 2;
      return [...document.querySelectorAll('.tempo-gap')].some((g) => {
        const b = g.getBoundingClientRect();
        return b.left <= x && x <= b.right;
      });
    }), 'Hoop sits over the hatched band');
    const lead = page.locator('.readout-row[data-lead="true"]');
    assert.equal(await lead.getAttribute('data-missing'), 'true');
    // Not reported, and when the scene holds an earlier day's rate, the row names that day.
    const v = lead.locator('.readout-v');
    const state = await v.getAttribute('data-state');
    assert.match(state ?? '', /^(notReported|held)$/);
    assert.equal((await v.evaluate((el) => el.firstChild?.nextSibling?.textContent ?? ''))?.trim(), en.readout.notReported);
    if (state === 'held') assert.match(await v.locator('small').innerText(), /^plume shows /);
    const rate = page.locator('.camp-line', { hasText: en.camp.labels.rate });
    assert.equal(await rate.getAttribute('data-missing'), 'true');
    assert.equal((await rate.locator('dd').textContent())?.trim(), en.camp.rateMissing);
    for (const v of await page.locator('.readout-v').allInnerTexts()) {
      assert.doesNotMatch(v.trim(), /^0(\D|$)/, `the readout shows "${v}"`);
    }

    // The same day is marked the same way in the readout, the lanes, the camp panel and the chart.
    assert.equal(await page.locator('.tempo-selected').getAttribute('data-state'), await rate.getAttribute('data-state'));
    const marks = await page.evaluate(() => [...document.querySelectorAll('[data-state] .mark')].map((m) => [
      m.closest('[data-state]')!.getAttribute('data-state'), m.getAttribute('data-mark')]));
    const want: Record<string, string> = { reported: 'solid', saidNone: 'ring', notReported: 'hatched', held: 'dotted', continuous: 'half' };
    assert.ok(marks.length > 8);
    for (const [state, mark] of marks) assert.equal(mark, want[state!], `${state} is drawn as ${want[state!]}`);
    assert.deepEqual(await page.locator('.mark-key dt').allInnerTexts(),
      ['Reported', 'Said none', 'Not reported', 'Held', 'Continuous']);
    await page.context().close();
  });

  for (const width of [390, 1440]) {
    it(`shows the notice in view on arrival at ${width} wide`, async () => {
      for (const [route, dict] of [['/', en], ['/es/', es]] as const) {
        const page = await open(route, width, width === 390 ? 844 : 900);
        await ready(page);
        const notice = page.locator('#notice');
        assert.ok(await notice.isVisible());
        const seen = await notice.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { top: r.top, bottom: r.bottom, vh: innerHeight, onTop: hit !== null && el.contains(hit) };
        });
        assert.ok(seen.top >= 0 && seen.bottom <= seen.vh, `the notice is on the first screen of ${route}`);
        assert.ok(seen.onTop, `nothing covers the notice on ${route}`);
        assert.equal((await notice.locator('p').innerText()).trim(), `${dict.notice.lead} ${dict.notice.body}`);
        assert.equal(await notice.locator('a[href^="https://insivumeh.gob.gt"]').count(), 1);
        assert.equal(await notice.locator('a[href^="https://conred.gob.gt"]').count(), 1);
        await page.context().close();
      }
    });

    it(`has no serious accessibility issue at ${width} wide`, async () => {
      for (const route of ['/', '/es/', '/no-such-page']) {
        const page = await open(route, width, width === 390 ? 844 : 900);
        if (route !== '/no-such-page') await ready(page);
        assert.deepEqual(await seriousViolations(page, axeSource), [], `axe on ${route}`);
        await page.context().close();
      }
    });
  }

  it('reaches the top bar before the scene, and works the scene and the record from the keyboard', async () => {
    const page = await open('/');
    await ready(page);

    // Tab through the page and note where each stop is.
    const order: string[] = [];
    for (let k = 0; k < 20; k++) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return '';
        if (el.closest('.topbar .lang-switch')) return 'switch';
        if (el.closest('.massif-views')) return `view:${el.textContent}`;
        if (el.classList.contains('tempo-plot')) return 'scrub';
        return el.closest('#notice') ? 'notice' : el.tagName.toLowerCase();
      }));
    }
    const at = (s: string) => order.indexOf(s);
    assert.ok(at('switch') !== -1, `the language switch is reached (${order.join(', ')})`);
    assert.ok(at(`view:${en.massif.orbit}`) !== -1, 'the view buttons are reached');
    assert.ok(at('switch') < at(`view:${en.massif.orbit}`), `the top bar comes before the view buttons (${order.join(', ')})`);
    assert.ok(at(`view:${en.massif.orbit}`) < at('scrub'), 'the scene comes before the record');

    // The view switch: Enter and Space both press a button.
    const orbit = page.getByRole('button', { name: en.massif.orbit });
    const camp = page.getByRole('button', { name: en.massif.fromCamp });
    await camp.focus();
    await page.keyboard.press('Enter');
    assert.equal(await camp.getAttribute('aria-pressed'), 'true');
    assert.equal(await orbit.getAttribute('aria-pressed'), 'false');
    await orbit.focus();
    await page.keyboard.press('Space');
    assert.equal(await orbit.getAttribute('aria-pressed'), 'true');

    // The record scrub: arrows step a day, Home and End jump to the ends.
    const dates = index.entries.map((e) => e.date);
    const scrub = page.locator('.tempo-plot');
    await scrub.focus();
    assert.equal(await selectedDay(page), dates.at(-1));
    await page.keyboard.press('ArrowLeft');
    assert.equal(await selectedDay(page), dates.at(-2));
    assert.equal(await scrub.getAttribute('aria-valuenow'), String(dates.length - 2));
    await page.keyboard.press('Home');
    assert.equal(await selectedDay(page), dates[0]);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await selectedDay(page), dates[0], 'the first day is the end of the scale');
    await page.keyboard.press('End');
    assert.equal(await selectedDay(page), dates.at(-1));
    await page.context().close();
  });

  it('keeps the camp panel on the day the record and the mountain show', async () => {
    const page = await open('/');
    await ready(page);
    const dates = index.entries.map((e) => e.date);
    const campDay = () => page.locator('.camp-date time').getAttribute('datetime');
    const replaying = page.locator('.camp-date [data-replaying]');

    assert.equal(await campDay(), dates.at(-1));
    assert.equal(await replaying.count(), 0, 'the latest bulletin is not marked as a replay');

    await page.locator('.tempo-plot').focus();
    for (let k = 0; k < 5; k++) await page.keyboard.press('ArrowLeft');
    assert.equal(await campDay(), dates.at(-6));
    assert.equal(await campDay(), await selectedDay(page));
    assert.equal((await replaying.innerText()).trim().toLowerCase(), en.topbar.replaying.toLowerCase());

    await page.keyboard.press('End');
    assert.equal(await campDay(), dates.at(-1));
    assert.equal(await replaying.count(), 0);
    await page.context().close();
  });

  it('replays an earlier day with the dotted ring and the replay bar, and returns to the latest', async () => {
    const page = await open('/', 390, 844);
    await ready(page);
    const dates = index.entries.map((e) => e.date);
    const bar = page.locator('.replay-bar');
    const ring = page.locator('.observed-date');
    const short = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
      .format(new Date(`${iso}T00:00:00Z`));

    assert.equal(await bar.count(), 0, 'no replay bar on the latest day');
    assert.equal(await ring.getAttribute('data-replaying'), null);

    // Leaving the latest day: the ring and the bar, both naming the day.
    const scrub = page.locator('.tempo-plot');
    await scrub.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await ring.getAttribute('data-replaying'), 'true');
    assert.equal((await ring.innerText()).trim(), en.topbar.replayingOn(short(dates.at(-3)!)));
    assert.equal(await ring.evaluate((el) => getComputedStyle(el).borderTopStyle), 'dotted');
    assert.ok(await bar.isVisible());
    assert.match(await scrub.getAttribute('aria-valuetext') ?? '', new RegExp(`^${short(dates.at(-3)!)}: `));
    const back = bar.getByRole('button', { name: en.replay.back(short(dates.at(-1)!)) });
    assert.ok(await back.isVisible());
    for (const b of await bar.locator('button').all()) {
      const box = (await b.boundingBox())!;
      assert.ok(box.height >= 44 && box.width >= 44, `a 44 px target (${box.width}x${box.height})`);
    }
    // The bar is pinned to the bottom of the screen.
    const box = (await bar.boundingBox())!;
    assert.ok(Math.abs(box.y + box.height - 844) <= 1, `pinned to the bottom (${box.y + box.height})`);

    // Previous and next step a day.
    await bar.getByRole('button', { name: en.replay.previous }).click();
    assert.equal(await selectedDay(page), dates.at(-4));
    assert.equal(await page.locator('.camp-date time').getAttribute('datetime'), dates.at(-4));
    await bar.getByRole('button', { name: en.replay.next }).click();
    assert.equal(await selectedDay(page), dates.at(-3));

    // Back to the latest removes both, and hands focus back to the scrub.
    await bar.getByRole('button', { name: en.replay.back(short(dates.at(-1)!)) }).click();
    assert.equal(await selectedDay(page), dates.at(-1));
    assert.equal(await bar.count(), 0);
    assert.equal(await ring.getAttribute('data-replaying'), null);
    await page.waitForFunction(() => document.activeElement?.id === 'record-scrub');
    await page.context().close();
  });

  it('sends a reader who chose Spanish on before the English page runs any script', async () => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${origin}${BASE}/es/`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('fuego-lang', 'es'));

    // With every bundled script refused, only the inline script in the page
    // itself can move the reader, and it does so before the page is shown.
    await context.route('**/_next/static/**/*.js', (route) => route.abort());
    await page.goto(`${origin}${BASE}/#record`, { waitUntil: 'load' });
    await page.waitForURL(`${origin}${BASE}/es/#record`);
    assert.equal(await page.getAttribute('html', 'lang'), 'es');

    // A reader with no choice, or English, stays on the English page.
    await page.evaluate(() => localStorage.setItem('fuego-lang', 'en'));
    await page.goto(`${origin}${BASE}/`, { waitUntil: 'load' });
    assert.equal(await page.getAttribute('html', 'lang'), 'en');
    assert.equal(await page.evaluate(() => document.documentElement.style.visibility), '');
    assert.equal(new URL(page.url()).pathname, `${BASE}/`);
    await context.close();
  });

  it('carries the brand on the 404, in both languages', async () => {
    const page = await open('/no-such-page', 390, 844);
    const brand = page.locator('.lost .brand');
    assert.ok(await brand.isVisible());
    assert.equal((await brand.innerText()).trim().toUpperCase(), 'FUEGO');
    assert.equal(new URL(await page.locator('.lost a[href$="/"]').first().evaluate((a: HTMLAnchorElement) => a.href)).pathname, `${BASE}/`);
    assert.equal(await page.locator('.lost a[href$="/es/"]').count(), 1);
    await page.context().close();
  });
});
