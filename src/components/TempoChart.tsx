'use client';

import { useMemo, useState } from 'react';

import { axisLabelIndices, rateRuns, rateText } from '@/lib/readout';
import type { IndexEntry } from '../../scripts/build-index';

const W = 1000;
const H = 220;
const PAD = { t: 14, b: 24 };

/** Smooths a polyline into a bezier path, so the tempo reads as a ridgeline. */
function smooth(pts: Array<[number, number]>, tension = 0.45): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d +=
      `C${p1[0] + ((p2[0] - p0[0]) / 6) * tension},${p1[1] + ((p2[1] - p0[1]) / 6) * tension},` +
      `${p2[0] - ((p3[0] - p1[0]) / 6) * tension},${p2[1] - ((p3[1] - p1[1]) / 6) * tension},` +
      `${p2[0]},${p2[1]}`;
  }
  return d;
}

interface TempoChartProps {
  series: IndexEntry[];
  /** Index of the day currently driving the scene. */
  selected: number;
  onSelect: (index: number) => void;
}

export default function TempoChart({ series, selected, onSelect }: TempoChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const { runs, gaps, xs, ys, maxY, ticks, half } = useMemo(() => {
    // Only reported days set the scale; a missing day is not a 0.
    const reported = series.flatMap((e) => (e.explosionsMax === null ? [] : [e.explosionsMax]));
    const top = reported.length > 0 ? Math.max(...reported) : 0;
    const maxY = Math.max(20, Math.ceil((top * 1.12) / 10) * 10);
    const step = series.length > 1 ? W / (series.length - 1) : W;
    const xs = series.map((_, i) => (series.length > 1 ? i * step : W / 2));
    const yOf = (v: number) => H - PAD.b - (v / maxY) * (H - PAD.t - PAD.b);
    // Null for a day with no rate: there is no point to draw.
    const ys = series.map((e) => (e.explosionsMax === null ? null : yOf(e.explosionsMax)));
    const { reported: runs, missing: gaps } = rateRuns(series);
    return {
      runs: runs.map((r) => {
        const pts = xs.slice(r.start, r.end + 1).map((x, k) => [x, ys[r.start + k] as number] as [number, number]);
        const line = smooth(pts);
        return {
          key: r.start,
          pts,
          line,
          area: line && `${line}L${pts.at(-1)![0]},${H - PAD.b}L${pts[0][0]},${H - PAD.b}Z`,
        };
      }),
      gaps,
      xs,
      ys,
      maxY,
      ticks: Array.from({ length: Math.floor(maxY / 10) }, (_, i) => (i + 1) * 10),
      half: step / 2,
    };
  }, [series]);

  const missingDays = gaps.reduce((n, g) => n + g.end - g.start + 1, 0);

  const active = hover === null ? null : series[hover];

  function indexAt(ev: React.PointerEvent<SVGSVGElement>): number {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    return Math.max(0, Math.min(series.length - 1, Math.round((x / W) * (series.length - 1))));
  }

  function onMove(ev: React.PointerEvent<SVGSVGElement>) {
    const i = indexAt(ev);
    setHover(i);
    // Dragging scrubs the scene; a plain hover only moves the crosshair.
    if (ev.buttons === 1) onSelect(i);
  }

  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', timeZone: 'UTC',
    });

  return (
    <figure className="tempo">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Explosions per hour over ${series.length} days; ${missingDays} of them gave no rate and are left as gaps`}
        onPointerMove={onMove}
        onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); onSelect(indexAt(ev)); }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="tempoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="tempo-stop" stopOpacity="0.36" />
            <stop offset="100%" className="tempo-stop" stopOpacity="0" />
          </linearGradient>
          <pattern id="tempoGap" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className="tempo-gap-hatch" />
          </pattern>
        </defs>

        {/* Days with no reported rate: a quiet hatch, never a line at 0. */}
        {gaps.map((g) => {
          const x0 = Math.max(0, xs[g.start] - half);
          const x1 = Math.min(W, xs[g.end] + half);
          return (
            <rect key={g.start} className="tempo-gap" x={x0} y={PAD.t} width={x1 - x0}
              height={H - PAD.t - PAD.b} fill="url(#tempoGap)" />
          );
        })}

        {ticks.map((v) => {
          const y = H - PAD.b - (v / maxY) * (H - PAD.t - PAD.b);
          return (
            <g key={v}>
              <line x1={0} x2={W} y1={y} y2={y} className="tempo-grid" />
              <text x={4} y={y - 5} className="tempo-tick">{v}</text>
            </g>
          );
        })}

        {runs.map((r) =>
          r.pts.length > 1 ? (
            <g key={r.key}>
              <path d={r.area} fill="url(#tempoFill)" />
              <path d={r.line} className="tempo-line" />
            </g>
          ) : (
            // A reported day between two gaps has no neighbour to join.
            <circle key={r.key} cx={r.pts[0][0]} cy={r.pts[0][1]} r={2.5} className="tempo-dot" />
          ),
        )}

        {axisLabelIndices(series.length).map((i) => (
          <text key={i} x={Math.min(xs[i], W - 46)} y={H - 6} className="tempo-tick">
            {fmt(series[i].date).toUpperCase()}
          </text>
        ))}

        <g className="tempo-selected">
          <line x1={xs[selected]} x2={xs[selected]} y1={PAD.t} y2={H - PAD.b}
            className="tempo-cross" strokeWidth={1.5} opacity={0.85} />
          {ys[selected] === null ? (
            <circle cx={xs[selected]} cy={PAD.t + 5} r={4.5}
              className="tempo-ring" />
          ) : (
            <circle cx={xs[selected]} cy={ys[selected]!} r={5}
              className="tempo-point" />
          )}
        </g>

        {hover !== null && (
          <>
            <line x1={xs[hover]} x2={xs[hover]} y1={PAD.t} y2={H - PAD.b}
              className="tempo-cross" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
            {ys[hover] !== null && <circle cx={xs[hover]} cy={ys[hover]!} r={3.5} className="tempo-dot" />}
          </>
        )}
      </svg>

      <figcaption className="tempo-tip" data-on={active !== null}
        data-edge={hover === null ? undefined : xs[hover] < W * 0.12 ? 'start' : xs[hover] > W * 0.88 ? 'end' : undefined}
        style={{ left: `${(hover === null ? 0 : xs[hover] / W) * 100}%` }}>
        {active && (
          <>
            <b>{fmt(active.date)}</b>
            <span>
              {active.explosionsMax !== null
                ? `${rateText(active.explosionsMin, active.explosionsMax)} explosions/hr`
                : active.phenomena.includes('continuousPhase')
                  ? 'Continuous emission, no hourly count'
                  : 'Explosion rate not reported'}
            </span>
            <span>
              {active.ashMaxMasl !== null ? `ash ${active.ashMaxMasl.toLocaleString('en-GB')} m` : 'ash not reported'}
              {' · '}
              {active.driftKm !== null ? `drift ${active.driftKm} km` : 'drift not reported'}
            </span>
          </>
        )}
      </figcaption>

      {missingDays > 0 && (
        <p className="tempo-key">
          <span className="tempo-key-swatch" aria-hidden="true" />
          Not reported: {missingDays} of {series.length} days gave no explosion rate
        </p>
      )}
    </figure>
  );
}
