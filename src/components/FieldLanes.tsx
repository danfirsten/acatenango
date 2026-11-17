'use client';

import { useId, useMemo, useState } from 'react';

import Mark from '@/components/ink/Mark';
import { formatNumber, formatShortDate, getDict, type Locale } from '@/i18n';
import { AXIS_W as W, bearing, dayAt, dayX, fieldSummary, incandescenceTop } from '@/lib/fields';
import type { IndexEntry } from '../../scripts/build-index';

interface FieldLanesProps {
  series: IndexEntry[];
  /** The one shared selection, the same index the tempo chart and the mountain use. */
  selected: number;
  onSelect: (index: number) => void;
  locale: Locale;
}

const ROW = 15;
const BAR_H = 30;
const MARK_H = 26;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const list = (names: string[]) => names.join(', ');

/**
 * Compact lanes under the tempo chart on the same time axis: where the ash
 * drifted, how high the glow reached, which drainages were named and which
 * towns had ash. A day that did not state a field is a hatched cell, never a
 * short bar or an empty mark that could pass for a zero.
 */
export default function FieldLanes({ series, selected, onSelect, locale }: FieldLanesProps) {
  const t = getDict(locale);
  const l10n = t.lanes;
  const fmt = (iso: string) => formatShortDate(locale, iso);
  const abbr = (dirs: string[]) => dirs.map((dir) => t.compassAbbr[dir] ?? dir);
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
    // The slider pattern: arrows step a day, Home and End jump to the first and latest.
    const to = ev.key === 'ArrowLeft' ? selected - 1
      : ev.key === 'ArrowRight' ? selected + 1
      : ev.key === 'Home' ? 0
      : ev.key === 'End' ? n - 1
      : null;
    if (to === null) return;
    ev.preventDefault();
    onSelect(Math.max(0, Math.min(n - 1, to)));
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
      title: l10n.driftTitle,
      note: l10n.daysOf(summary.driftReported, n),
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
      title: l10n.driftTitle,
      note: `${l10n.daysOf(summary.driftReported, n)} · ${l10n.firstNamed}`,
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
      title: l10n.glowTitle,
      note: l10n.glowNote(top === null ? null : formatNumber(locale, top)),
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
      title: l10n.drainagesTitle,
      note: l10n.daysOf(summary.drainagesReported, n),
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
      title: l10n.townsTitle,
      note: l10n.daysOf(summary.townsReported, n),
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

  const drift = summary.driftReported === 0
    ? l10n.notReported
    : l10n.commonDriftValue(summary.commonDrift, summary.commonDriftDays);

  return (
    <figure className="lanes" id="lanes" aria-label={l10n.figureLabel}>
      <div
        className="lanes-plot"
        tabIndex={0}
        role="slider"
        aria-label={l10n.sliderLabel}
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
        <span>{l10n.dayDrift(d.driftDirections.length > 0 ? abbr(d.driftDirections).join(' · ') : null)}</span>
        <span>{l10n.dayGlow(d.incandescenceMaxM !== null ? formatNumber(locale, d.incandescenceMaxM) : null)}</span>
        <span>{l10n.dayDrainages(d.drainages.length > 0 ? list(d.drainages) : null)}</span>
        <span>{l10n.dayTowns(d.ashfallCommunities.length > 0 ? list(d.ashfallCommunities) : null)}</span>
      </figcaption>

      <p className="tempo-key">
        <span><Mark kind="hatched" />{l10n.key}</span>
      </p>

      <dl className="lanes-summary">
        <div>
          <dt>{l10n.commonDrift}</dt>
          <dd>{drift}</dd>
          <dd className="figures-note">{l10n.commonDriftNote(summary.driftReported)}</dd>
        </div>
        <div>
          <dt>{l10n.drainagesNamed}</dt>
          <dd>
            {summary.drainages.length === 0 ? l10n.notReported : (
              <ul>{summary.drainages.map((c) => <li key={c.name}>{c.name} <span>{c.days}</span></li>)}</ul>
            )}
          </dd>
          <dd className="figures-note">{l10n.drainagesNote(summary.drainagesReported)}</dd>
        </div>
      </dl>
    </figure>
  );
}
