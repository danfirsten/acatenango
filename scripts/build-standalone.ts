/**
 * Bundles the whole experience into one self-contained HTML file.
 *
 * Three.js, the scene, the styles and the elevation heightmap are all inlined,
 * so the result opens from a file:// URL with no server and no network. That is
 * also what makes it publishable as an Artifact, where a strict CSP blocks every
 * external host.
 *
 *   npm run build:standalone
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import * as esbuild from 'esbuild';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'dist', 'fuego-standalone.html');

async function main(): Promise<void> {
  const bundle = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/standalone/entry.ts')],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    minify: true,
    write: false,
    absWorkingDir: ROOT,
    // Matches the tsconfig alias; esbuild does not read tsconfig paths here.
    alias: { '@': path.join(ROOT, 'src') },
  });
  const js = bundle.outputFiles[0].text;

  const meta = await readFile(path.join(ROOT, 'public/terrain/massif.json'), 'utf8');
  const png = await readFile(path.join(ROOT, 'public/terrain/massif.png'));
  const css = await readFile(path.join(ROOT, 'src/app/globals.css'), 'utf8');

  // Inline the real archive so the offline file carries the collected record
  // rather than the placeholder.
  let seriesJson = '[]';
  try {
    const index = JSON.parse(await readFile(path.join(ROOT, 'data/index.json'), 'utf8'));
    seriesJson = JSON.stringify(index.entries ?? []);
  } catch {
    // No archive yet; the entry point falls back to the labelled placeholder.
  }

  const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fuego</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@400;500;600&display=swap">
<style>
${css.replace(/var\(--font-barlow-condensed\)/g, '"Barlow Condensed"')
     .replace(/var\(--font-barlow\)/g, '"Barlow"')}
.labels { position: absolute; inset: 0; pointer-events: none; }
.tick { font-family: "Barlow Condensed", sans-serif; font-size: 10.5px; letter-spacing: .12em; fill: #7F909E; }
.tip {
  position: absolute; top: -6px; transform: translate(-50%, -100%);
  display: flex; flex-direction: column; gap: 1px; padding: 9px 12px;
  background: #17212B; border: 1px solid #2B3945; font-size: 12px; line-height: 1.45;
  white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity .12s ease;
  font-variant-numeric: tabular-nums;
}
.tip span { color: #7F909E; }
</style>

<main>
  <section class="hero">
    <div class="massif">
      <canvas class="massif-canvas" aria-label="The Acatenango and Fuego massif, built from elevation data"></canvas>
      <div class="labels"></div>
      <div class="massif-state">Loading elevation data…</div>
    </div>
    <header class="topbar">
      <span class="brand">Fuego</span>
      <span class="observed">Loading…</span>
    </header>
    <aside class="readout"></aside>
    <div class="massif-views" role="group" aria-label="Camera view">
      <button type="button" data-view="orbit" aria-pressed="true">Orbit</button>
      <button type="button" data-view="camp" aria-pressed="false">From camp</button>
    </div>
    <div class="scrollcue" aria-hidden="true"><span>The record below drives the mountain</span></div>
  </section>

  <section class="record">
    <div class="record-head">
      <div>
        <h2>Explosion tempo</h2>
        <p>Fuego does not stop. It pulses — six to fourteen times an hour on an ordinary day,
           then, every few weeks, it does something else entirely. Drag along the record and the
           mountain replays that day.</p>
      </div>
    </div>
    <figure class="tempo"></figure>
    <footer class="colophon">
      <p>Terrain from AWS Terrain Tiles, SRTM-derived and public domain — Fuego resolves to
         3,771 m against a published 3,763 m. Vertical relief is exaggerated ×1.55 so 2.9 km
         of it across 14 km reads the way it does from the ridge. The ninety-day series is
         representative pending OCR of the scanned INSIVUMEH bulletins.</p>
    </footer>
  </section>
</main>

<script>
window.__MASSIF_META__ = ${meta.trim()};
window.__MASSIF_PNG__ = "data:image/png;base64,${png.toString('base64')}";
window.__SERIES__ = ${seriesJson};
</script>
<script type="module">
${js}
</script>
`;

  await writeFile(OUT, html, 'utf8');
  const kb = (n: number) => `${Math.round(n / 1024)} KB`;
  console.log(`[standalone] js ${kb(js.length)}, terrain ${kb(png.length)} → ${kb(html.length)} total`);
  console.log(`[standalone] wrote ${path.relative(ROOT, OUT)}`);
}

main().catch((err) => { console.error('[standalone] failed:', err); process.exitCode = 1; });
