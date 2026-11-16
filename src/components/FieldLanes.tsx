'use client';

import { useId, useMemo, useState } from 'react';

import { AXIS_W as W, bearing, dayAt, dayX, fieldSummary, incandescenceTop } from '@/lib/fields';
import type { IndexEntry } from '../../scripts/build-index';

interface FieldLanesProps {
  series: IndexEntry[];
  /** The one shared selection, the same index the tempo chart and the mountain use. */
  selected: number;
  onSelect: (index: number) => void;
}

const ROW = 15;
const BAR_H = 30;
const MARK_H = 26;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const list = (names: string[]) => names.join(', ');
const none = 'not reported';
const times = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * Compact lanes under the tempo chart on the same time axis: where the ash
 * drifted, how high the glow reached, which drainages were named and which
 * towns had ash. A day that did not state a field is a hatched cell, never a
 * short bar or an empty mark that could pass for a zero.
 */
export default function FieldLanes({ series, selected, onSelect }: FieldLanesProps) {
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId();
  const hatch = `${uid}-hatch`;
  const n = series.length;
  const step = n > 1 ? W / (n - 1) : W;
  const cell = Math.max(step * 0.8, 1.4);

  const summary = useMemo(() => fieldSummary(series), [series]);
  const top = useMemo(() => incandescenceTop(series), [series]);
  const rows = Math.max(1, Math.min(3, Math.max(0, ...series.map((e) => e.driftDirections.length))));
  const maxDrain = Math.max(1, ...series.map((e) => e.drainages.length));
  const maxTowns = Math.max(1, ...series.map((e) => e.ashfallCommunities.length));

  const shown = hover ?? selected;
  const d = series[Math.min(shown, n - 1)];

  function indexAt(ev: React.PointerEvent<HTMLElement>): number {
    const r = ev.currentTarget.getBoundingClientRect();
    return dayAt(((ev.clientX - r.left) / r.width) * W, n);
  }

  function onKey(ev: React.KeyboardEvent) {
    const move = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0;
    if (move === 0) return;
    ev.preventDefault();
    onSelect(Math.max(0, Math.min(n - 1, selected + move)));
  }

  /** The day's column, the selected-day line, and the hover line, shared by every lane. */
  const marker = (h: number) => (
    <>
      <line x1={dayX(selected, n)} x2={dayX(selected, n)} y1={0} y2={h} className="lane-sel" />
      {hover !== null && hover !== selected && (
        <line x1={dayX(hover, n)} x2={dayX(hover, n)} y1={0} y2={h} className="lane-hover" />
      )}
    </>
  );

  const missing = (id: string, i: number, h: number) => (
    <rect key={`m${i}`} className="lane-missing" fill={`url(#${hatch}-${id})`}
      x={dayX(i, n) - cell / 2} width={cell} y={2} height={h - 4} />
  );

  const lanes: Array<{ id: string; title: string; note: string; h: number; body: React.ReactNode }> = [
    {
      id: 'drift',
      title: 'Ash drift toward',
      note: `${summary.driftReported} of ${n} days`,
      h: rows * ROW + 6,
      body: series.map((e, i) =>
        e.driftDirections.length === 0
          ? missing('drift', i, rows * ROW + 6)
          : e.driftDirections.slice(0, rows).map((dir, k) => {
              const a = bearing(dir);
              if (a === null) return null;
              const s = Math.min(Math.max(step * 0.45, 1.6), 4.5);
              return (
                <path key={`${i}-${k}`} className="lane-arrow"
                  transform={`translate(${dayX(i, n)} ${3 + ROW * k + ROW / 2}) rotate(${a})`}
                  d={`M0,${s * 1.5}L0,${-s * 1.5}M${-s},${-s * 0.5}L0,${-s * 1.5}L${s},${-s * 0.5}`} />
              );
            }),
      ),
    },
    {
      id: 'driftdots',
      title: 'Ash drift toward',
      note: `${summary.driftReported} of ${n} days · first direction named`,
      h: COMPASS.length * 6 + 6,
      body: series.map((e, i) => {
        const row = COMPASS.indexOf(e.driftDirections[0]);
        return e.driftDirections.length === 0 || row === -1
          ? missing('driftdots', i, COMPASS.length * 6 + 6)
          : <rect key={i} className="lane-mark" x={dayX(i, n) - cell / 2} width={cell} y={3 + row * 6} height={4} />;
      }),
    },
    {
      id: 'glow',
      title: 'Incandescence height',
      note: top === null ? 'not reported' : `up to ${top.toLocaleString('en-GB')} m above the crater`,
      h: BAR_H + 6,
      body: series.map((e, i) =>
        e.incandescenceMaxM === null ? missing('glow', i, BAR_H + 6) : (
          <rect key={i} className="lane-bar" x={dayX(i, n) - cell / 2} width={cell}
            y={BAR_H + 3 - Math.max(1.5, (e.incandescenceMaxM / (top as number)) * BAR_H)}
            height={Math.max(1.5, (e.incandescenceMaxM / (top as number)) * BAR_H)} />
        ),
      ),
    },
    {
      id: 'drainages',
      title: 'Drainages named',
      note: `${summary.drainagesReported} of ${n} days`,
      h: MARK_H + 6,
      body: series.map((e, i) =>
        e.drainages.length === 0 ? missing('drainages', i, MARK_H + 6) : (
          <rect key={i} className="lane-mark" x={dayX(i, n) - cell / 2} width={cell}
            y={MARK_H + 3 - Math.max(4, (e.drainages.length / maxDrain) * MARK_H)}
            height={Math.max(4, (e.drainages.length / maxDrain) * MARK_H)} />
        ),
      ),
    },
    {
      id: 'towns',
      title: 'Ash-fall towns named',
      note: `${summary.townsReported} of ${n} days`,
      h: MARK_H + 6,
      body: series.map((e, i) =>
        e.ashfallCommunities.length === 0 ? missing('towns', i, MARK_H + 6) : (
          <rect key={i} className="lane-mark" x={dayX(i, n) - cell / 2} width={cell}
            y={MARK_H + 3 - Math.max(4, (e.ashfallCommunities.length / maxTowns) * MARK_H)}
            height={Math.max(4, (e.ashfallCommunities.length / maxTowns) * MARK_H)} />
        ),
      ),
    },
  ];

    const drift = summary.driftReported === 0 ? none : `${list(summary.commonDrift)} (${times(summary.commonDriftDays)})`;

  return (
    <figure className="lanes" aria-label="Daily fields from the bulletin, on the same days as the chart above">
      <div
        className="lanes-plot"
        tabIndex={0}
        role="slider"
        aria-label="Selected day"
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={selected}
        aria-valuetext={d ? fmt(series[selected].date) : undefined}
        onKeyDown={onKey}
        onPointerMove={(ev) => { const i = indexAt(ev); setHover(i); if (ev.buttons === 1) onSelect(i); }}
        onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); onSelect(indexAt(ev)); }}
        onPointerLeave={() => setHover(null)}
      >
        {lanes.map((l) => (
          <div className="lane" key={l.id} data-lane={l.id}>
            <p className="lane-head"><span>{l.title}</span><span className="lane-note">{l.note}</span></p>
            <svg viewBox={`0 0 ${W} ${l.h}`} preserveAspectRatio="none" style={{ aspectRatio: `${W} / ${l.h}` }}
              role="img" aria-label={`${l.title}: ${l.note}`}>
              <defs>
                <pattern id={`${hatch}-${l.id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="6" className="tempo-gap-hatch" />
                </pattern>
              </defs>
              {l.body}
              {marker(l.h)}
            </svg>
          </div>
        ))}
      </div>

      <figcaption className="lanes-day" >
        <b>{fmt(d.date)}</b>
        <span>Drift {d.driftDirections.length > 0 ? `toward ${d.driftDirections.join(' · ')}` : none}</span>
        <span>Glow {d.incandescenceMaxM !== null ? `${d.incandescenceMaxM.toLocaleString('en-GB')} m` : none}</span>
        <span>Drainages {d.drainages.length > 0 ? list(d.drainages) : none}</span>
        <span>Towns {d.ashfallCommunities.length > 0 ? list(d.ashfallCommunities) : none}</span>
      </figcaption>

      <p className="tempo-key">
        <span><span className="tempo-key-swatch" aria-hidden="true" />Field not stated that day</span>
      </p>

      <dl className="lanes-summary">
        <div>
          <dt>Most common drift</dt>
          <dd>{drift}</dd>
          <dd className="figures-note">of {summary.driftReported} days that stated one</dd>
        </div>
        <div>
          <dt>Drainages named</dt>
          <dd>
            {summary.drainages.length === 0 ? none : (
              <ul>{summary.drainages.map((c) => <li key={c.name}>{c.name} <span>{c.days}</span></li>)}</ul>
            )}
          </dd>
          <dd className="figures-note">days named, of {summary.drainagesReported} days that named any</dd>
        </div>
      </dl>
    </figure>
  );
}
