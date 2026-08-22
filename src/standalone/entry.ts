/**
 * Entry point for the self-contained single-file build (scripts/build-standalone.ts).
 *
 * Deliberately framework-free: the standalone file exists to be opened from
 * anywhere with no server and no network, so it carries the scene and nothing
 * else. The Next.js app is the real site; this is the shareable demo.
 */

import { demoSeries } from '@/lib/demo-series';
import { axisLabelIndices, readoutRows } from '@/lib/readout';
import type { IndexEntry } from '../../scripts/build-index';
import {
  type LabelPosition,
  type MassifHandle,
  type MassifMeta,
  createMassifScene,
  loadHeightfield,
} from '@/lib/scene/massif';

/** Set once the scene is running; the record below drives it through this. */
let sceneHandle: MassifHandle | null = null;

declare global {
  interface Window {
    __MASSIF_META__: MassifMeta;
    __MASSIF_PNG__: string;
    /** Real archive, inlined at build time; absent means fall back. */
    __SERIES__?: IndexEntry[];
  }
}

const $ = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
};

const series = window.__SERIES__?.length ? window.__SERIES__ : demoSeries();
const today = series[series.length - 1];

/* ── scene ───────────────────────────────────────────────────────────────── */

const canvas = $<HTMLCanvasElement>('.massif-canvas');
const labelHost = $<HTMLElement>('.labels');
const state = $<HTMLElement>('.massif-state');

function renderLabels(labels: LabelPosition[]) {
  for (const l of labels) {
    let node = labelHost.querySelector<HTMLElement>(`[data-key="${l.key}"]`);
    if (!node) {
      node = document.createElement('div');
      node.className = 'summit';
      node.dataset.key = l.key;
      node.dataset.active = String(l.key === 'fuego');
      node.innerHTML = `<span class="summit-dot"></span><span class="summit-text">` +
        `<b>${l.name}</b><i>${l.elevation.toLocaleString()} m · ` +
        `${l.key === 'fuego' ? 'erupting' : 'your camp'}</i></span>`;
      labelHost.appendChild(node);
    }
    node.style.transform = `translate(${l.x}px, ${l.y}px)`;
    node.style.opacity = l.visible ? '1' : '0';
  }
}

(async () => {
  try {
    const meta = window.__MASSIF_META__;
    const field = await loadHeightfield(window.__MASSIF_PNG__, meta);
    const handle = createMassifScene(canvas, field, meta, {
      activity: today.explosionsMax ?? 10,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onLabels: renderLabels,
    });
    sceneHandle = handle;
    state.remove();

    for (const btn of document.querySelectorAll<HTMLButtonElement>('.massif-views button')) {
      btn.addEventListener('click', () => {
        for (const b of document.querySelectorAll('.massif-views button')) {
          b.setAttribute('aria-pressed', String(b === btn));
        }
        handle.setView(btn.dataset.view as 'orbit' | 'camp');
      });
    }
  } catch (err) {
    console.error(err);
    state.textContent = 'This view needs WebGL.';
  }
})();

/* ── readout and record ──────────────────────────────────────────────────── */

// Rendered after the scene is under way. The 3D view is the reason the page
// exists; a mistake down here must never be able to stop it starting.
try {
  /* ── readout ─────────────────────────────────────────────────────────────── */

  $('.readout').innerHTML = readoutRows(today)
    .map((r) =>
      `<div class="readout-row"${r.lead ? ' data-lead="true"' : ''}>` +
      `<span class="readout-k">${r.key}</span>` +
      `<span class="readout-v">${r.value}<small>${r.unit}</small></span></div>`)
    .join('');

  /* ── tempo chart ─────────────────────────────────────────────────────────── */

  function smooth(pts: Array<[number, number]>, t = 0.45): string {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
      d += `C${p1[0] + ((p2[0] - p0[0]) / 6) * t},${p1[1] + ((p2[1] - p0[1]) / 6) * t},` +
           `${p2[0] - ((p3[0] - p1[0]) / 6) * t},${p2[1] - ((p3[1] - p1[1]) / 6) * t},${p2[0]},${p2[1]}`;
    }
    return d;
  }

  const W = 1000, H = 220, PAD_T = 14, PAD_B = 24;
  const maxY = Math.ceil((Math.max(...series.map((e) => e.explosionsMax ?? 0)) * 1.12) / 10) * 10;
  const xOf = (i: number) => (i * W) / (series.length - 1);
  const yOf = (v: number) => H - PAD_B - (v / maxY) * (H - PAD_T - PAD_B);
  const pts = series.map((e, i) => [xOf(i), yOf(e.explosionsMax ?? 0)] as [number, number]);
  const line = smooth(pts);
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  const gridLines = Array.from({ length: Math.floor(maxY / 10) }, (_, i) => (i + 1) * 10)
    .map((v) => `<line x1="0" x2="${W}" y1="${yOf(v)}" y2="${yOf(v)}" stroke="#1E2A34"/>` +
                `<text x="4" y="${yOf(v) - 5}" class="tick">${v}</text>`)
    .join('');

  const dateLabels = axisLabelIndices(series.length)
    .map((i) => `<text x="${Math.min(xOf(i), W - 46)}" y="${H - 6}" class="tick">${fmt(series[i].date).toUpperCase()}</text>`)
    .join('');

  $('.tempo').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Explosions per hour over ninety days">
      <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E8622C" stop-opacity=".36"/>
        <stop offset="100%" stop-color="#E8622C" stop-opacity="0"/>
      </linearGradient></defs>
      ${gridLines}
      <path d="${line}L${W},${H - PAD_B}L0,${H - PAD_B}Z" fill="url(#f)"/>
      <path d="${line}" fill="none" stroke="#E8622C" stroke-width="2" stroke-linejoin="round"/>
      ${dateLabels}
      <g class="sel">
        <line y1="${PAD_T}" y2="${H - PAD_B}" stroke="#E8622C" stroke-width="1.5" opacity=".85"/>
        <circle r="5" fill="#E8622C" stroke="#0B1016" stroke-width="2"/>
      </g>
      <line class="cross" y1="${PAD_T}" y2="${H - PAD_B}" stroke="#E8622C" stroke-width="1"
            stroke-dasharray="2 3" opacity="0"/>
    </svg>
    <div class="tip"></div>`;

  const svg = $<SVGSVGElement>('.tempo svg');
  const cross = $<SVGLineElement>('.tempo .cross');
  const tip = $<HTMLElement>('.tempo .tip');
  const selLine = $<SVGLineElement>('.tempo .sel line');
  const selDot = $<SVGCircleElement>('.tempo .sel circle');
  const observed = $<HTMLElement>('.observed');

  const indexAt = (clientX: number) => {
    const r = svg.getBoundingClientRect();
    return Math.max(0, Math.min(series.length - 1,
      Math.round(((clientX - r.left) / r.width) * (series.length - 1))));
  };

  /** Point the whole page at one archived day. */
  function selectDay(i: number) {
    const e = series[i];
    selLine.setAttribute('x1', String(xOf(i)));
    selLine.setAttribute('x2', String(xOf(i)));
    selDot.setAttribute('cx', String(xOf(i)));
    selDot.setAttribute('cy', String(yOf(e.explosionsMax ?? 0)));

    $('.readout').innerHTML = readoutRows(e)
      .map((r) =>
        `<div class="readout-row"${r.lead ? ' data-lead="true"' : ''}>` +
        `<span class="readout-k">${r.key}</span>` +
        `<span class="readout-v">${r.value}<small>${r.unit}</small></span></div>`)
      .join('');

    observed.textContent =
      `${i === series.length - 1 ? 'Latest bulletin' : 'Replaying'} · ${fmt(e.date)} ${e.date.slice(0, 4)}`;

    sceneHandle?.setDay({
      explosionsPerHour: e.explosionsMax,
      ashColumnMasl: e.ashMaxMasl,
      driftDirections: e.driftDirections,
    });
  }

  selectDay(series.length - 1);

  svg.addEventListener('pointermove', (ev) => {
    const i = indexAt(ev.clientX);
    const e = series[i];
    cross.setAttribute('x1', String(xOf(i)));
    cross.setAttribute('x2', String(xOf(i)));
    cross.setAttribute('opacity', '0.6');
    tip.innerHTML = `<b>${fmt(e.date)}</b>` +
      `<span>${e.explosionsMax === null ? 'no rate published' : `${e.explosionsMin}–${e.explosionsMax} explosions/hr`}</span>` +
      `<span>ash ${e.ashMaxMasl?.toLocaleString() ?? '—'} m · drift ${e.driftKm ?? '—'} km</span>`;
    tip.style.left = `${(xOf(i) / W) * 100}%`;
    tip.style.opacity = '1';
    // Dragging scrubs; a plain hover only moves the crosshair.
    if (ev.buttons === 1) selectDay(i);
  });
  svg.addEventListener('pointerdown', (ev) => {
    svg.setPointerCapture(ev.pointerId);
    selectDay(indexAt(ev.clientX));
  });
  svg.addEventListener('pointerleave', () => {
    cross.setAttribute('opacity', '0');
    tip.style.opacity = '0';
  });
} catch (err) {
  console.error('[fuego] could not render the record', err);
}
