'use client';

import { useId, useMemo, useRef, useState } from 'react';

import { StateMark, useWidth } from '@/components/TempoChart';
import { formatNumber, formatShortDate, getDict, type Locale } from '@/i18n';
import { CAMP_BEARING_DEG, compassPoint } from '@/lib/camp';
import { fieldSummary, incandescenceTop } from '@/lib/fields';
import { fieldState, PLOT_GUTTER, plotDayAt, plotX, type ValueState } from '@/lib/readout';
import type { IndexEntry } from '../../scripts/build-index';

interface FieldLanesProps {
  series: IndexEntry[];
  /** The one shared selection, the same index the tempo chart and the mountain use. */
  selected: number;
  onSelect: (index: number) => void;
  locale: Locale;
}

/** Each compass row of the drift lane, in pixels. */
const ROW = 7;
const BAR_H = 30;
const MARK_H = 24;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** The rows labelled in the gutter. */
const LABELLED = ['N', 'E', 'S', 'W'];
/** Camp's row: the compass point ash drifts towards to reach Acatenango. */
const CAMP_POINT = compassPoint(CAMP_BEARING_DEG);

const list = (names: string[]) => names.join(', ');

/**
 * Compact lanes under the tempo chart on the same time axis: where the ash
 * drifted (one row per compass point, camp's row dashed), how high the glow
 * reached, which drainages were named and which towns had ash. A day that did
 * not state a field is a hatched cell, never a short bar or an empty mark that
 * could pass for a zero; ash fall with no town named is a ring.
 *
 * Drawn in pixels at the measured width, so lanes keep their height on a phone.
 * Dragging here scrubs too; the keyboard scrub is the chart above.
 */
export default function FieldLanes({ series, selected, onSelect, locale }: FieldLanesProps) {
  const t = getDict(locale);
  const l10n = t.lanes;
  const fmt = (iso: string) => formatShortDate(locale, iso);
  const abbr = (dirs: string[]) => dirs.map((dir) => t.compassAbbr[dir] ?? dir);
  const [hover, setHover] = useState<number | null>(null);
  const figRef = useRef<HTMLElement>(null);
  const W = useWidth(figRef);
  const uid = useId();
  const hatch = `${uid}-hatch`;
  const n = series.length;
  const x = (i: number) => plotX(i, n, W);
  const step = n > 1 ? x(1) - x(0) : W - PLOT_GUTTER;
  const cell = Math.max(step * 0.7, 1.5);

  const summary = useMemo(() => fieldSummary(series), [series]);
  const top = useMemo(() => incandescenceTop(series), [series]);
  const maxDrain = Math.max(1, ...series.map((e) => e.drainages.length));
  const maxTowns = Math.max(1, ...series.map((e) => e.ashfallCommunities.length));

  const at = Math.min(selected, n - 1);
  const shown = hover ?? at;
  const d = series[Math.min(shown, n - 1)];

  function indexAt(ev: React.PointerEvent<HTMLElement>): number {
    const r = ev.currentTarget.getBoundingClientRect();
    return plotDayAt(((ev.clientX - r.left) / r.width) * W, n, W);
  }

  /** The selected-day line and the hover line, shared by every lane. */
  const marker = (h: number) => (
    <>
      <line x1={x(at)} x2={x(at)} y1={0} y2={h} className="lane-sel" />
      {hover !== null && hover !== at && <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} className="lane-hover" />}
    </>
  );

  const missing = (i: number, h: number) => (
    <rect key={`m${i}`} className="lane-missing" fill={`url(#${hatch})`}
      x={x(i) - cell / 2} width={cell} y={2} height={h - 4} />
  );

  const bar = (i: number, value: number, max: number, h: number, min: number, cls: string) => {
    const height = Math.max(min, (value / max) * (h - 4));
    return <rect key={i} className={cls} x={x(i) - cell / 2} width={cell} y={h - 2 - height} height={height} />;
  };

  const driftH = COMPASS.length * ROW + 4;
  const rowY = (k: number) => 2 + k * ROW + ROW / 2;
  const campRow = COMPASS.indexOf(CAMP_POINT);

  const lanes: Array<{ id: string; title: string; note: string; h: number; gutter?: React.ReactNode; body: React.ReactNode }> = [
    {
      id: 'compass',
      title: l10n.driftTitle,
      note: `${l10n.daysOf(summary.driftReported, n)} · ${l10n.campRow}`,
      h: driftH,
      gutter: (
        <>
          {LABELLED.map((p) => (
            <text key={p} x={0} y={rowY(COMPASS.indexOf(p)) + 4} className="lane-tick"
              data-camp={p === CAMP_POINT || undefined}>{t.compassAbbr[p] ?? p}</text>
          ))}
          <line x1={PLOT_GUTTER} x2={W} y1={rowY(campRow)} y2={rowY(campRow)} className="lane-camp" />
        </>
      ),
      body: series.map((e, i) => {
        const rows = e.driftDirections.map((dir) => COMPASS.indexOf(dir)).filter((k) => k !== -1);
        return rows.length === 0
          ? missing(i, driftH)
          : rows.map((k) => (
            <rect key={`${i}-${k}`} className="lane-mark" x={x(i) - cell / 2} width={cell} y={rowY(k) - ROW / 2 + 1} height={ROW - 2} />
          ));
      }),
    },
    {
      id: 'glow',
      title: l10n.glowTitle,
      note: l10n.glowNote(top === null ? null : formatNumber(locale, top)),
      h: BAR_H + 4,
      body: series.map((e, i) =>
        e.incandescenceMaxM === null ? missing(i, BAR_H + 4) : bar(i, e.incandescenceMaxM, top as number, BAR_H + 4, 1.5, 'lane-bar')),
    },
    {
      id: 'drainages',
      title: l10n.drainagesTitle,
      note: l10n.daysOf(summary.drainagesReported, n),
      h: MARK_H + 4,
      body: series.map((e, i) =>
        e.drainages.length === 0 ? missing(i, MARK_H + 4) : bar(i, e.drainages.length, maxDrain, MARK_H + 4, 4, 'lane-mark')),
    },
    {
      id: 'towns',
      title: l10n.townsTitle,
      note: l10n.daysOf(summary.townsReported, n),
      h: MARK_H + 4,
      body: series.map((e, i) => {
        const state = fieldState(e, 'towns');
        return state === 'reported' ? bar(i, e.ashfallCommunities.length, maxTowns, MARK_H + 4, 4, 'lane-mark')
          : state === 'saidNone'
            // Ash fall with no town named: the ring, a statement and not a gap.
            ? <circle key={i} className="lane-none" data-state={state} cx={x(i)} cy={(MARK_H + 4) / 2} r={Math.min(3, Math.max(2, step / 2))} />
            : missing(i, MARK_H + 4);
      }),
    },
  ];

  const drift = summary.driftReported === 0
    ? l10n.notReported
    : l10n.commonDriftValue(summary.commonDrift, summary.commonDriftDays);

  const drawn = (state: ValueState, text: string) => (
    <span className="marked" data-state={state}><StateMark state={state} />{text}</span>
  );
  const towns = fieldState(d, 'towns');

  return (
    <figure className="lanes" id="lanes" aria-label={l10n.figureLabel} ref={figRef}>
      <div
        className="lanes-plot"
        onPointerMove={(ev) => { const i = indexAt(ev); setHover(i); if (ev.buttons === 1) onSelect(i); }}
        onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); onSelect(indexAt(ev)); }}
        onPointerLeave={() => setHover(null)}
      >
        <svg width="0" height="0" className="lane-defs" aria-hidden="true">
          <defs>
            <pattern id={hatch} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" className="tempo-gap-hatch" />
            </pattern>
          </defs>
        </svg>
        {lanes.map((l) => (
          <div className="lane" key={l.id} data-lane={l.id}>
            <p className="lane-head"><span>{l.title}</span><span className="lane-note">{l.note}</span></p>
            <svg viewBox={`0 0 ${W} ${l.h}`} width={W} height={l.h} role="img" aria-label={`${l.title}: ${l.note}`}>
              {l.gutter}
              {l.body}
              <line x1={PLOT_GUTTER} x2={W} y1={l.h - 0.5} y2={l.h - 0.5} className="lane-base" />
              {marker(l.h)}
            </svg>
          </div>
        ))}
      </div>

      <figcaption className="lanes-day">
        <b>{fmt(d.date)}</b>
        {drawn(fieldState(d, 'drift'), l10n.dayDrift(d.driftDirections.length > 0 ? abbr(d.driftDirections).join(' · ') : null))}
        {drawn(fieldState(d, 'glow'), l10n.dayGlow(d.incandescenceMaxM !== null ? formatNumber(locale, d.incandescenceMaxM) : null))}
        {drawn(fieldState(d, 'drainages'), l10n.dayDrainages(d.drainages.length > 0 ? list(d.drainages) : null))}
        {drawn(towns, towns === 'saidNone' ? l10n.dayTownsNone : l10n.dayTowns(d.ashfallCommunities.length > 0 ? list(d.ashfallCommunities) : null))}
      </figcaption>

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
