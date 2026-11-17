'use client';

import { type RefObject, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { HOOP_BODY, HOOP_EYES } from '@/components/ink/Hoop';
import Mark from '@/components/ink/Mark';
import { type Dict, formatNumber, formatShortDate, getDict, type Locale } from '@/i18n';
import {
  axisLabelIndices, fieldState, PLOT_GUTTER, plotDayAt, plotX, rateRuns, rateText, runDays, STATE_MARK,
  type ValueState, VALUE_STATES,
} from '@/lib/readout';
import type { IndexEntry } from '../../scripts/build-index';

/** Drawn width before the chart has been measured. */
const DEFAULT_W = 1000;
/** Below this width the chart is a phone's: shorter, with only its first and last dates. */
const NARROW = 600;
/** One user unit is one CSS pixel, so type and strokes are the size the stylesheet says. */
const heightFor = (w: number) => (w < NARROW ? 136 : 200);
/** Room above for Hoop's eyes, and below for the dates. */
const PAD = { t: 30, b: 24 };
/** Hoop's radius on the chart, in pixels. */
const HOOP_R = 15;

/** The element's width in CSS pixels, kept up to date as it resizes. */
export function useWidth(ref: RefObject<HTMLElement | null>, fallback = DEFAULT_W): number {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(Math.max(260, Math.round(el.clientWidth)) || fallback);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, fallback]);
  return w;
}

/**
 * The mark for a value's state. It always sits beside words that say the same,
 * so it is hidden from screen readers; `data-state` names it for tests.
 */
export function StateMark({ state }: { state: ValueState }) {
  return <span className="state-mark" data-state={state}><Mark kind={STATE_MARK[state]} /></span>;
}

/**
 * The key to the five marks, in the system's order, each with its word and
 * what it means. `counts` adds how many days are in a state.
 */
export function MarkKey({ t, counts = {} }: { t: Dict; counts?: Partial<Record<ValueState, string>> }) {
  return (
    <dl className="mark-key" aria-label={t.marks.label}>
      {VALUE_STATES.map((s) => (
        <div key={s} data-state={s}>
          <dt><Mark kind={STATE_MARK[s]} />{t.marks.word[s]}</dt>
          <dd>{t.marks.hint[s]}{counts[s] && <span className="mark-key-count">{counts[s]}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** How the day's rate reads, in words. */
export function rateWords(e: IndexEntry, t: Dict): string {
  const state = fieldState(e, 'rate');
  return state === 'reported' ? t.tempo.rate(rateText(e.explosionsMin, e.explosionsMax as number))
    : state === 'continuous' ? t.tempo.continuous : t.tempo.rateMissing;
}

interface TempoChartProps {
  series: IndexEntry[];
  /** Index of the day currently driving the scene. */
  selected: number;
  onSelect: (index: number) => void;
  locale: Locale;
}

/**
 * The explosion rate as schematic ink: a 1 px line through each run of
 * reported days, a 1 px baseline, a faint mid rule, and hatched bands where the
 * bulletin gave no rate, with no line across them. Hoop sits over the selected
 * day like a lens, and the line inside it is drawn bold.
 *
 * The plot is the record's scrub: drag it, or focus it and use the arrows,
 * Home and End. Every other part of the page follows the same day.
 */
export default function TempoChart({ series, selected, onSelect, locale }: TempoChartProps) {
  const dict = getDict(locale);
  const t = dict.tempo;
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const figRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLElement>(null);
  const W = useWidth(figRef);
  const H = heightFor(W);
  const n = series.length;
  const base = H - PAD.b;

  const { runs, gaps, continuous, xs, ys, maxY, half } = useMemo(() => {
    // Only reported days set the scale; a missing day is not a 0.
    const reported = series.flatMap((e) => (e.explosionsMax === null ? [] : [e.explosionsMax]));
    const top = reported.length > 0 ? Math.max(...reported) : 0;
    const maxY = Math.max(20, Math.ceil((top * 1.1) / 10) * 10);
    const xs = series.map((_, i) => plotX(i, n, W));
    const yOf = (v: number) => base - (v / maxY) * (base - PAD.t);
    // Null for a day with no rate: there is no point to draw.
    const ys = series.map((e) => (e.explosionsMax === null ? null : yOf(e.explosionsMax)));
    const { reported: runs, missing: gaps, continuous } = rateRuns(series);
    return {
      runs: runs.map((r) => ({
        key: r.start,
        pts: xs.slice(r.start, r.end + 1).map((x, k) => `${x},${ys[r.start + k]}`).join(' '),
        single: r.start === r.end ? { x: xs[r.start], y: ys[r.start] as number } : null,
      })),
      gaps,
      continuous,
      xs,
      ys,
      maxY,
      half: n > 1 ? (xs[1] - xs[0]) / 2 : (W - PLOT_GUTTER) / 2,
    };
  }, [series, n, W, base]);

  const missingDays = runDays(gaps);
  const continuousDays = runDays(continuous);
  const band = (r: { start: number; end: number }) => {
    const x0 = Math.max(PLOT_GUTTER, xs[r.start] - half);
    return { x: x0, width: Math.min(W, xs[r.end] + half) - x0, y: PAD.t, height: base - PAD.t };
  };
  const midY = base - (base - PAD.t) / 2;

  const at = Math.min(selected, n - 1);
  const day = series[at];
  // On a day with no rate Hoop rests on the band at mid height: any point would sit on the scale.
  const hoop = { x: xs[at], y: ys[at] ?? midY };
  const active = hover === null ? null : series[hover];
  const fmt = (iso: string) => formatShortDate(locale, iso);
  const labels = W < NARROW ? [0, n - 1].filter((v, i, a) => a.indexOf(v) === i) : axisLabelIndices(n);

  // Centre the tip over the hovered day, but keep it inside the chart.
  useLayoutEffect(() => {
    const fig = figRef.current;
    const tip = tipRef.current;
    if (!fig || !tip || hover === null) return;
    const width = fig.clientWidth;
    const x = (xs[hover] / W) * width - tip.offsetWidth / 2;
    tip.style.left = `${Math.max(0, Math.min(width - tip.offsetWidth, x))}px`;
  }, [hover, xs, W]);

  function indexAt(ev: React.PointerEvent<HTMLElement>): number {
    const r = ev.currentTarget.getBoundingClientRect();
    return plotDayAt(((ev.clientX - r.left) / r.width) * W, n, W);
  }

  function onKey(ev: React.KeyboardEvent) {
    // The slider pattern: arrows step a day, Home and End jump to the first and latest.
    const to = ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? at - 1
      : ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? at + 1
      : ev.key === 'Home' ? 0
      : ev.key === 'End' ? n - 1
      : null;
    if (to === null) return;
    ev.preventDefault();
    onSelect(Math.max(0, Math.min(n - 1, to)));
  }

  const clip = `${uid}-lens`;
  const hatch = `${uid}-gap`;

  return (
    <figure className="tempo" ref={figRef}>
      <div
        className="tempo-plot"
        id="record-scrub"
        tabIndex={0}
        role="slider"
        aria-label={dict.lanes.sliderLabel}
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={at}
        aria-valuetext={t.valueText(formatShortDate(locale, day.date), rateWords(day, dict))}
        onKeyDown={onKey}
        onPointerMove={(ev) => { const i = indexAt(ev); setHover(i); if (ev.buttons === 1) onSelect(i); }}
        onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); onSelect(indexAt(ev)); }}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
          aria-label={t.aria(n, missingDays, continuousDays)}>
          <defs>
            <pattern id={hatch} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" className="tempo-gap-hatch" />
            </pattern>
            <clipPath id={clip}>
              <circle cx={hoop.x} cy={hoop.y} r={HOOP_R - 1} />
            </clipPath>
          </defs>

          {/* A faint rule at half the scale, labelled in the gutter. */}
          <line x1={PLOT_GUTTER} x2={W} y1={midY} y2={midY} className="tempo-mid" />
          <text x={0} y={midY + 4} className="tempo-tick">{formatNumber(locale, maxY / 2)}</text>
          <text x={0} y={PAD.t + 4} className="tempo-tick">{formatNumber(locale, maxY)}</text>

          {/* Continuous emission: the volcano at its most active, with no hourly count. */}
          {continuous.map((r) => {
            const b = band(r);
            return (
              <g key={`c${r.start}`} data-state="continuous">
                <rect className="tempo-continuous" {...b} />
                <rect className="tempo-continuous-cap" x={b.x} y={base + 2} width={b.width} height={3} />
              </g>
            );
          })}

          {/* Days with no reported rate: a hatched band, never a line at 0. */}
          {gaps.map((g) => <rect key={g.start} className="tempo-gap" fill={`url(#${hatch})`} {...band(g)} />)}

          <line x1={PLOT_GUTTER} x2={W} y1={base} y2={base} className="tempo-base" />

          {runs.map((r) => (r.single
            // A reported day between two gaps has no neighbour to join.
            ? <circle key={r.key} cx={r.single.x} cy={r.single.y} r={2} className="tempo-dot" />
            : <polyline key={r.key} points={r.pts} className="tempo-line" />))}

          {labels.map((i, k) => (
            <text key={i} x={xs[i]} y={H - 6} className="tempo-tick"
              textAnchor={k === 0 && i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {fmt(series[i].date)}
            </text>
          ))}

          {hover !== null && hover !== at && (
            <line x1={xs[hover]} x2={xs[hover]} y1={PAD.t} y2={base} className="tempo-hover" />
          )}

          {/* Hoop: the line inside the lens goes bold. */}
          <g className="tempo-selected" data-state={fieldState(day, 'rate')}>
            <g clipPath={`url(#${clip})`}>
              {runs.map((r) => (r.single
                ? <circle key={r.key} cx={r.single.x} cy={r.single.y} r={3} className="tempo-dot" />
                : <polyline key={r.key} points={r.pts} className="tempo-line tempo-line-bold" />))}
            </g>
            {/* A tick on the baseline marks the exact day under the lens. */}
            <line x1={hoop.x} x2={hoop.x} y1={base - 4} y2={base + 4} className="tempo-tick-day" />
            <g className="tempo-hoop" style={{ transform: `translate(${hoop.x}px, ${hoop.y}px)` }}>
              <circle r={HOOP_R} className="tempo-hoop-lens" />
              <path d={HOOP_BODY} transform={`scale(${HOOP_R / 14.25})`} className="tempo-hoop-body" />
              <path d={HOOP_EYES} transform={`translate(0 ${-HOOP_R - 7}) scale(0.7)`} className="tempo-hoop-eyes" />
            </g>
          </g>
        </svg>
      </div>

      <figcaption className="tempo-tip" ref={tipRef} data-on={active !== null}>
        {active && (
          <>
            <b>{fmt(active.date)}</b>
            <span>{rateWords(active, dict)}</span>
            <span>
              {active.ashMaxMasl !== null ? t.ash(formatNumber(locale, active.ashMaxMasl)) : t.ashMissing}
              {' · '}
              {active.driftKm !== null ? t.drift(formatNumber(locale, active.driftKm)) : t.driftMissing}
            </span>
          </>
        )}
      </figcaption>

      <MarkKey t={dict} counts={{
        ...(missingDays > 0 && { notReported: t.keyDays(missingDays, n) }),
        ...(continuousDays > 0 && { continuous: t.keyDays(continuousDays, n) }),
      }} />
    </figure>
  );
}
