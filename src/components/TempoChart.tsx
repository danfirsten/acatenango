'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { axisLabelIndices, rateRuns, rateText, runDays } from '@/lib/readout';
import type { IndexEntry } from '../../scripts/build-index';

/** Drawn width before the chart has been measured. */
const DEFAULT_W = 1000;
/**
 * One user unit is one CSS pixel, so type is the size the stylesheet says on
 * every screen. Narrow screens get a taller plot so the line stays readable.
 */
const heightFor = (w: number) => (w < 600 ? 260 : 220);
const PAD = { t: 14, b: 28 };

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
  const figRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLElement>(null);
  const [W, setW] = useState(DEFAULT_W);
  const H = heightFor(W);

  useEffect(() => {
    const fig = figRef.current;
    if (!fig) return;
    const measure = () => setW(Math.max(260, Math.round(fig.clientWidth)) || DEFAULT_W);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(fig);
    return () => observer.disconnect();
  }, []);

  const { runs, gaps, continuous, xs, ys, maxY, ticks, half } = useMemo(() => {
    // Only reported days set the scale; a missing day is not a 0.
    const reported = series.flatMap((e) => (e.explosionsMax === null ? [] : [e.explosionsMax]));
    const top = reported.length > 0 ? Math.max(...reported) : 0;
    const maxY = Math.max(20, Math.ceil((top * 1.12) / 10) * 10);
    const step = series.length > 1 ? W / (series.length - 1) : W;
    const xs = series.map((_, i) => (series.length > 1 ? i * step : W / 2));
    const yOf = (v: number) => H - PAD.b - (v / maxY) * (H - PAD.t - PAD.b);
    // Null for a day with no rate: there is no point to draw.
    const ys = series.map((e) => (e.explosionsMax === null ? null : yOf(e.explosionsMax)));
    const { reported: runs, missing: gaps, continuous } = rateRuns(series);
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
      continuous,
      xs,
      ys,
      maxY,
      ticks: Array.from({ length: Math.floor(maxY / 10) }, (_, i) => (i + 1) * 10),
      half: step / 2,
    };
  }, [series, W, H]);

  const missingDays = runDays(gaps);
  const continuousDays = runDays(continuous);
  const band = (r: { start: number; end: number }) => {
    const x0 = Math.max(0, xs[r.start] - half);
    return { x: x0, width: Math.min(W, xs[r.end] + half) - x0, y: PAD.t, height: H - PAD.t - PAD.b };
  };

  const active = hover === null ? null : series[hover];

  // Centre the tip over the hovered day, but keep it inside the chart: on a
  // phone the chart is narrower than a fixed edge rule can allow for.
  useLayoutEffect(() => {
    const fig = figRef.current;
    const tip = tipRef.current;
    if (!fig || !tip || hover === null) return;
    const width = fig.clientWidth;
    const x = (xs[hover] / W) * width - tip.offsetWidth / 2;
    tip.style.left = `${Math.max(0, Math.min(width - tip.offsetWidth, x))}px`;
  }, [hover, xs, W]);

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
    <figure className="tempo" ref={figRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Explosions per hour over ${series.length} days; ${missingDays} gave no rate and are left as gaps${continuousDays ? `, and ${continuousDays} were continuous emission with no hourly count` : ''}`}
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

        {/* Continuous emission: the volcano at its most active, with no hourly count. */}
        {continuous.map((r) => {
          const b = band(r);
          return (
            <g key={`c${r.start}`}>
              <rect className="tempo-continuous" {...b} />
              <rect className="tempo-continuous-cap" x={b.x} y={H - PAD.b + 2} width={b.width} height={3} />
            </g>
          );
        })}

        {/* Days with no reported rate: a quiet hatch, never a line at 0. */}
        {gaps.map((g) => <rect key={g.start} className="tempo-gap" fill="url(#tempoGap)" {...band(g)} />)}

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
          <text key={i} x={Math.min(xs[i], W - 52)} y={H - 8} className="tempo-tick">
            {fmt(series[i].date).toUpperCase()}
          </text>
        ))}

        <g className="tempo-selected">
          <line x1={xs[selected]} x2={xs[selected]} y1={PAD.t} y2={H - PAD.b}
            className="tempo-cross" strokeWidth={1.5} opacity={0.85} />
          {/* A day with no rate gets the line alone: any point would sit on the scale. */}
          {ys[selected] !== null && (
            <circle cx={xs[selected]} cy={ys[selected]!} r={5} className="tempo-point" />
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

      <figcaption className="tempo-tip" ref={tipRef} data-on={active !== null}>
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

      {(missingDays > 0 || continuousDays > 0) && (
        <p className="tempo-key">
          {missingDays > 0 && (
            <span>
              <span className="tempo-key-swatch" aria-hidden="true" />
              Not reported: {missingDays} of {series.length} days
            </span>
          )}
          {continuousDays > 0 && (
            <span>
              <span className="tempo-key-swatch" data-kind="continuous" aria-hidden="true" />
              Continuous emission, no hourly count: {continuousDays} days
            </span>
          )}
        </p>
      )}
    </figure>
  );
}
