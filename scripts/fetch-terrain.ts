/**
 * Downloads the real elevation grid for the Acatenango–Fuego massif and bakes it
 * into a heightmap the browser can load in one request.
 *
 * Output is a PNG rather than JSON: a 512x512 grid of metres is a megabyte of
 * text but ~300 KB as an image, and the browser decodes it for free. Elevation
 * is packed into R and G as a 16-bit value; B is unused.
 *
 *   npm run fetch:terrain
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PNG } from 'pngjs';

import { fetchWithRetry } from '../src/lib/fetch-text';
import {
  SUMMITS,
  decodeTerrarium,
  lonLatToTile,
  metresPerPixel,
  tileToLonLat,
  tileUrl,
} from '../src/lib/terrain';

const ZOOM = 13;           // ~18 m/px here — enough to resolve both craters
const GRID = 512;          // output heightmap resolution
const OUT_DIR = path.join(process.cwd(), 'public', 'terrain');

/** Centre the grid between the two summits so both sit well inside the frame. */
const CENTRE = {
  lat: (SUMMITS.fuego.lat + SUMMITS.acatenango.lat) / 2,
  lon: (SUMMITS.fuego.lon + SUMMITS.acatenango.lon) / 2,
};

async function fetchTile(z: number, x: number, y: number): Promise<PNG> {
  const res = await fetchWithRetry(tileUrl(z, x, y));
  const buf = Buffer.from(await res.arrayBuffer());
  return PNG.sync.read(buf);
}

async function main(): Promise<void> {
  const centreTile = lonLatToTile(CENTRE.lon, CENTRE.lat, ZOOM);
  // A 3x3 block at z13 spans roughly 14 km — both cones plus their aprons.
  const x0 = Math.floor(centreTile.x) - 1;
  const y0 = Math.floor(centreTile.y) - 1;
  const N = 3, TILE = 256, SPAN = N * TILE;

  console.log(`[terrain] zoom ${ZOOM}, tiles x${x0}..${x0 + N - 1} y${y0}..${y0 + N - 1}`);

  const grid = new Float32Array(SPAN * SPAN);
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      const png = await fetchTile(ZOOM, x0 + tx, y0 + ty);
      for (let py = 0; py < TILE; py++) {
        for (let px = 0; px < TILE; px++) {
          const i = (png.width * py + px) << 2;
          grid[(ty * TILE + py) * SPAN + (tx * TILE + px)] =
            decodeTerrarium(png.data[i], png.data[i + 1], png.data[i + 2]);
        }
      }
      console.log(`[terrain]   tile ${tx},${ty} ok`);
    }
  }

  // Resample to the output grid (box filter — the source is already smooth).
  const step = SPAN / GRID;
  const out = new Float32Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const sx = Math.min(SPAN - 1, Math.round(x * step));
      const sy = Math.min(SPAN - 1, Math.round(y * step));
      out[y * GRID + x] = grid[sy * SPAN + sx];
    }
  }

  let min = Infinity, max = -Infinity;
  for (const v of out) { if (v < min) min = v; if (v > max) max = v; }

  // Verify we actually got this massif, not an empty ocean tile or a 404 page.
  const check = (s: { lat: number; lon: number; elevation: number; name: string }) => {
    const t = lonLatToTile(s.lon, s.lat, ZOOM);
    const px = Math.round(((t.x - x0) * TILE) / step);
    const py = Math.round(((t.y - y0) * TILE) / step);
    // The summit pixel can be a few cells off; take the local maximum.
    let peak = -Infinity;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const v = out[(py + dy) * GRID + (px + dx)];
        if (v !== undefined && v > peak) peak = v;
      }
    const delta = peak - s.elevation;
    console.log(`[terrain] ${s.name}: DEM ${Math.round(peak)} m vs published ${s.elevation} m (${delta > 0 ? '+' : ''}${Math.round(delta)} m)`);
    return Math.abs(delta) < 120;
  };

  const ok = check(SUMMITS.fuego) && check(SUMMITS.acatenango);
  if (!ok) throw new Error('Summit elevations do not match — wrong tiles or bad decode');

  // Pack to 16-bit across R/G so the browser can read it back exactly.
  const png = new PNG({ width: GRID, height: GRID, colorType: 6 });
  for (let i = 0; i < out.length; i++) {
    const norm = Math.round(((out[i] - min) / (max - min)) * 65535);
    const o = i << 2;
    png.data[o] = norm >> 8;
    png.data[o + 1] = norm & 255;
    png.data[o + 2] = 0;
    png.data[o + 3] = 255;
  }

  const nw = tileToLonLat(x0, y0, ZOOM);
  const se = tileToLonLat(x0 + N, y0 + N, ZOOM);
  const meta = {
    source: 'AWS Terrain Tiles (terrarium) — SRTM/NED derived, public domain',
    zoom: ZOOM, grid: GRID,
    // Tile origin, so the browser can place points in the same Mercator space
    // the grid was sampled in rather than approximating from the lat/lon box.
    tileOrigin: { x: x0, y: y0, tiles: N, tileSize: TILE },
    minElevation: Math.round(min * 100) / 100,
    maxElevation: Math.round(max * 100) / 100,
    bounds: { north: nw.lat, west: nw.lon, south: se.lat, east: se.lon },
    metresPerPixel: (metresPerPixel(CENTRE.lat, ZOOM) * SPAN) / GRID,
    spanMetres: metresPerPixel(CENTRE.lat, ZOOM) * SPAN,
    summits: SUMMITS,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'massif.png'), PNG.sync.write(png));
  await writeFile(path.join(OUT_DIR, 'massif.json'), `${JSON.stringify(meta, null, 2)}\n`);

  console.log(`[terrain] elevation range ${Math.round(min)}–${Math.round(max)} m`);
  console.log(`[terrain] span ${(meta.spanMetres / 1000).toFixed(1)} km, ${meta.metresPerPixel.toFixed(1)} m/px`);
  console.log(`[terrain] wrote public/terrain/massif.png + massif.json`);
}

main().catch((err) => { console.error('[terrain] failed:', err); process.exitCode = 1; });
