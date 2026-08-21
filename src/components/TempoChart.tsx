'use client';

import { useMemo, useState } from 'react';

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

export default function TempoChart({ series }: { series: IndexEntry[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const { path, area, pts, maxY, ticks } = useMemo(() => {
    const maxY = Math.max(20, Math.ceil((Math.max(...series.map((e) => e.explosionsMax ?? 0)) * 1.12) / 10) * 10);
    const xOf = (i: number) => (i * W) / (series.length - 1);
    const yOf = (v: number) => H - PAD.b - (v / maxY) * (H - PAD.t - PAD.b);
    const pts = series.map((e, i) => [xOf(i), yOf(e.explosionsMax ?? 0)] as [number, number]);
    const path = smooth(pts);
    return {
      path,
      area: `${path}L${W},${H - PAD.b}L0,${H - PAD.b}Z`,
      pts,
      maxY,
      ticks: Array.from({ length: Math.floor(maxY / 10) }, (_, i) => (i + 1) * 10),
    };
  }, [series]);

  const active = hover === null ? null : series[hover];

  function onMove(ev: React.PointerEvent<SVGSVGElement>) {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(series.length - 1, Math.round((x / W) * (series.length - 1)))));
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
        aria-label={`Explosions per hour over ${series.length} days`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="tempoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8622C" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#E8622C" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((v) => {
          const y = H - PAD.b - (v / maxY) * (H - PAD.t - PAD.b);
          return (
            <g key={v}>
              <line x1={0} x2={W} y1={y} y2={y} stroke="#1E2A34" strokeWidth={1} />
              <text x={4} y={y - 5} className="tempo-tick">{v}</text>
            </g>
          );
        })}

        <path d={area} fill="url(#tempoFill)" />
        <path d={path} fill="none" stroke="#E8622C" strokeWidth={2} strokeLinejoin="round" />

        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={4}
          fill="#E8622C" stroke="#0B1016" strokeWidth={2} />

        {[0, Math.floor(series.length / 3), Math.floor((series.length * 2) / 3), series.length - 1].map((i) => (
          <text key={i} x={Math.min(pts[i][0], W - 46)} y={H - 6} className="tempo-tick">
            {fmt(series[i].date).toUpperCase()}
          </text>
        ))}

        {hover !== null && (
          <>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={PAD.t} y2={H - PAD.b}
              stroke="#E8622C" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r={3.5} fill="#E8622C" />
          </>
        )}
      </svg>

      <figcaption className="tempo-tip" data-on={active !== null}
        style={{ left: `${(hover === null ? 0 : pts[hover][0] / W) * 100}%` }}>
        {active && (
          <>
            <b>{fmt(active.date)}</b>
            <span>{active.explosionsMin}–{active.explosionsMax} explosions/hr</span>
            <span>ash {(active.ashMaxMasl ?? 0).toLocaleString()} m · drift {active.driftKm} km</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
