/**
 * The GitHub Pages build, served the way Pages serves it: from a subfolder.
 *
 * Proves that with PAGES_BASE_PATH set, every asset the page asks for resolves
 * under the base path (no console errors, no failed requests), and that one
 * visit is enough for the service worker to bring the whole page back offline.
 *
 *   npm run test:e2e   (builds out/ with PAGES_BASE_PATH=/acatenango first)
 *
 * Set PLAYWRIGHT_CHROMIUM to use a Chromium other than Playwright's own.
 */

import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { type AddressInfo } from 'node:net';
import { type Server, createServer } from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { type Browser, chromium } from 'playwright';

import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';

const BASE = '/acatenango';
const OUT = path.join(process.cwd(), 'out');

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

/**
 * A static host that, like GitHub Pages, serves out/ only under BASE: a
 * directory gives its index.html, `/x` gives `x.html`, and anything outside
 * BASE is a 404. A path the build forgot to prefix fails here as it would live.
 */
function subfolderServer(): Server {
  return createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname === BASE) {
      res.writeHead(301, { location: `${BASE}/` }).end();
      return;
    }
    if (!pathname.startsWith(`${BASE}/`)) {
      res.writeHead(404).end('outside the base path');
      return;
    }
    const rel = decodeURIComponent(pathname.slice(BASE.length));
    const file = path.join(OUT, rel);
    if (!file.startsWith(OUT)) {
      res.writeHead(400).end();
      return;
    }
    for (const candidate of rel.endsWith('/') ? [path.join(file, 'index.html')] : [file, `${file}.html`]) {
      if (await isFile(candidate)) {
        res.writeHead(200, { 'content-type': TYPES[path.extname(candidate)] ?? 'application/octet-stream' });
        res.end(await readFile(candidate));
        return;
      }
    }
    res.writeHead(404).end('not found');
  });
}

describe(`static build served under ${BASE}`, () => {
  let server: Server;
  let browser: Browser;
  let origin: string;

  before(async () => {
    assert.ok(await isFile(path.join(OUT, 'sw.js')), 'out/ has no sw.js: run `npm run test:e2e`, which builds first');
    server = subfolderServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM,
      // Software WebGL, so the terrain scene really starts in a headless run.
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
  });

  after(async () => {
    await browser?.close();
    await new Promise((resolve) => server?.close(resolve));
  });

  it('loads with no console errors, works offline after one visit', async () => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const problems: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', (r) => problems.push(`failed ${r.url()}: ${r.failure()?.errorText}`));

    // Online, first visit.
    await page.goto(`${origin}${BASE}/`, { waitUntil: 'load' });
    await page.locator('.brand').waitFor();
    // The terrain loaded from under the base path: the scene leaves no state message.
    await page.locator('.massif-canvas').waitFor();
    await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });

    // Every link the head points at resolves under the base path.
    const heads = await page.evaluate(() => ({
      manifest: document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ?? '',
      icon: document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href ?? '',
      og: document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? '',
    }));
    const manifestUrl = new URL(heads.manifest);
    assert.equal(manifestUrl.pathname, `${BASE}/manifest.webmanifest`);
    assert.equal(new URL(heads.icon).pathname, `${BASE}/icon.svg`);
    assert.equal(new URL(heads.og).pathname, `${BASE}/og.png`, 'og:image must sit under the base path');
    const manifest = await (await fetch(manifestUrl)).json() as { start_url: string; scope: string; icons: { src: string }[] };
    assert.equal(new URL(manifest.start_url, manifestUrl).pathname, `${BASE}/`);
    assert.equal(new URL(manifest.scope, manifestUrl).pathname, `${BASE}/`);
    for (const p of [new URL(heads.icon).pathname, new URL(heads.og).pathname,
      ...manifest.icons.map((i) => new URL(i.src, manifestUrl).pathname)]) {
      assert.equal((await fetch(`${origin}${p}`)).status, 200, `${p} should be served`);
    }

    // The worker is registered at the base path and has cached the site.
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    assert.equal(new URL(scope).pathname, `${BASE}/`);
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const cache = await caches.open(keys[0]);
      return (await cache.keys()).map((r) => new URL(r.url).pathname);
    });
    for (const p of [`${BASE}/`, `${BASE}/index.html`, `${BASE}/terrain/massif.png`, `${BASE}/terrain/massif.json`]) {
      assert.ok(cached.includes(p), `${p} should be precached`);
    }
    assert.ok(!cached.some((p) => !p.startsWith(`${BASE}/`)), 'nothing precached outside the base path');

    // The "From camp" panel and the mountain describe the same day: the
    // latest bulletin, which the scene opens on (and keeps in its camp view).
    const topbarDate = (await page.locator('.observed-date').textContent() ?? '').split('·').at(-1)?.trim();
    const campDate = (await page.locator('.camp-date time').textContent() ?? '').trim();
    assert.ok(campDate, 'the From camp panel states its bulletin date');
    assert.equal(campDate, topbarDate, 'the panel and the scene describe the same day');
    await page.getByRole('button', { name: 'From camp' }).click();
    assert.equal(
      (await page.locator('.observed-date').textContent() ?? '').split('·').at(-1)?.trim(),
      campDate,
      'the scene\'s camp view shows the panel\'s day',
    );
    assert.equal(await page.locator('#camp-title').innerText(), 'From camp');
    assert.equal(await page.locator('.camp a[href="#notice"]').count(), 1, 'the panel links the notice');
    assert.equal(await page.locator('#notice').count(), 1, 'the notice is there to link to');

    assert.deepEqual(problems, [], 'online visit should be clean');

    // Offline: the same page, terrain and all, from the cache alone.
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.locator('.brand').waitFor();
    await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });
    assert.deepEqual(problems, [], 'offline visit should be clean');

    await context.close();
  });

  it('serves the Spanish page at /es/, in Spanish throughout', async () => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });

    await page.goto(`${origin}${BASE}/es/`, { waitUntil: 'load' });
    await page.locator('.brand').waitFor();
    await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });

    assert.equal(await page.getAttribute('html', 'lang'), 'es');
    assert.equal(await page.title(), es.meta.title);
    const alternates = await page.evaluate(() => Object.fromEntries(
      [...document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')]
        .map((l) => [l.hreflang, new URL(l.href).pathname]),
    ));
    assert.equal(alternates.en, `${BASE}/`);
    assert.equal(alternates.es, `${BASE}/es/`);
    assert.equal(alternates['x-default'], `${BASE}/`);

    // The notice, word for word.
    assert.equal((await page.locator('#notice p').innerText()).trim(), `${es.notice.lead} ${es.notice.body}`);
    assert.equal(await page.locator('#camp-title').innerText(), es.camp.title);
    assert.equal(await page.getByRole('button', { name: es.massif.fromCamp }).count(), 1);

    // No English left on the page: no English dictionary string that Spanish
    // words differently appears in the text or the accessible labels.
    const text = await page.evaluate(() => [
      document.body.innerText,
      ...[...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') ?? ''),
    ].join('\n'));
    const spanish = new Set(Object.values(es).flatMap(function all(v: unknown): string[] {
      return typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(all) : [];
    }));
    const english = Object.values(en).flatMap(function all(v: unknown): string[] {
      return typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(all) : [];
    }).filter((s) => s.length > 6 && !spanish.has(s) && !s.includes('{'));
    for (const s of english) {
      // The switch back to English is meant to be in English.
      if (s === en.languageName || s === en.switchLabel) continue;
      assert.ok(!text.includes(s), `English on the Spanish page: ${s}`);
    }
    assert.deepEqual(problems, []);
    await context.close();
  });

  it('switches language in place and remembers the choice', async () => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${origin}${BASE}/`, { waitUntil: 'load' });
    await page.locator('.brand').waitFor();
    await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });

    // Replay an earlier day, then switch from the top bar: the day comes along.
    await page.locator('.tempo-plot').focus();
    for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowLeft');
    const day = await page.locator('[data-selected-day]').getAttribute('data-selected-day');
    assert.ok(day, 'a day is selected');
    const topSwitch = page.locator('.topbar .lang-switch');
    assert.equal(await topSwitch.textContent(), es.languageName);
    assert.equal(new URL(await topSwitch.evaluate((a: HTMLAnchorElement) => a.href)).pathname, `${BASE}/es/`);
    await topSwitch.click();
    await page.waitForURL(`${origin}${BASE}/es/`);
    await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });
    await page.waitForFunction((d) => document.querySelector('[data-selected-day]')?.getAttribute('data-selected-day') === d, day);
    assert.match(await page.locator('.observed-date').innerText(), new RegExp(es.topbar.replaying, 'i'));
    assert.equal(await page.evaluate(() => localStorage.getItem('fuego-lang')), 'es');

    // Switch back from the foot of the page: the reader stays at the foot.
    const footSwitch = page.locator('.colophon .lang-switch');
    await footSwitch.scrollIntoViewIfNeeded();
    assert.equal(await footSwitch.textContent(), en.languageName);
    await footSwitch.click();
    await page.waitForURL(`${origin}${BASE}/`);
    await page.waitForFunction(() => {
      const r = document.getElementById('colophon')?.getBoundingClientRect();
      return r !== undefined && r.top >= 0 && r.top < window.innerHeight;
    }, undefined, { timeout: 5_000 });
    assert.equal(await page.getAttribute('html', 'lang'), 'en');
    assert.equal(await page.evaluate(() => localStorage.getItem('fuego-lang')), 'en');

    // Having chosen English, a shared Spanish link still opens in Spanish.
    await page.goto(`${origin}${BASE}/es/`, { waitUntil: 'load' });
    await page.locator('#camp-title').waitFor();
    await page.waitForTimeout(500);
    assert.equal(new URL(page.url()).pathname, `${BASE}/es/`);

    // A remembered Spanish choice opens the Spanish page from the English address.
    await page.evaluate(() => localStorage.setItem('fuego-lang', 'es'));
    await page.goto(`${origin}${BASE}/`, { waitUntil: 'load' });
    await page.waitForURL(`${origin}${BASE}/es/`);
    assert.equal(await page.getAttribute('html', 'lang'), 'es');
    await context.close();
  });

  it('works when storage is blocked', async () => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    // As in a private window that refuses storage: every read and write throws.
    await context.addInitScript(() => {
      for (const m of ['getItem', 'setItem', 'removeItem'] as const) {
        Storage.prototype[m] = () => { throw new DOMException('blocked', 'SecurityError'); };
      }
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}${BASE}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => !document.querySelector('.massif-state'), undefined, { timeout: 30_000 });
    await page.locator('.topbar .lang-switch').click();
    await page.waitForURL(`${origin}${BASE}/es/`);
    await page.locator('#camp-title').waitFor();
    assert.equal(await page.getAttribute('html', 'lang'), 'es');
    assert.deepEqual(errors, []);
    await context.close();
  });
});
