'use client';

import { useCallback, useMemo, useState } from 'react';

import Massif from '@/components/Massif';
import TempoChart from '@/components/TempoChart';
import { lastReportedIndex, readoutRows, summaryFigures } from '@/lib/readout';
import type { IndexEntry } from '../../scripts/build-index';

interface FuegoViewProps {
  series: IndexEntry[];
  isRepresentative: boolean;
}

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});

function formatDate(iso: string): string {
  return DATE.format(new Date(`${iso}T00:00:00Z`));
}

/**
 * Holds the selected day. Scrubbing the record drives both the readout and the
 * 3D plume, so the chart and the volcano are two views of the same number.
 */
export default function FuegoView({ series, isRepresentative }: FuegoViewProps) {
  const [selected, setSelected] = useState(series.length - 1);
  const day = series[Math.min(selected, series.length - 1)];
  const isToday = selected === series.length - 1;

  const figures = useMemo(() => summaryFigures(series), [series]);
  const rows = useMemo(() => readoutRows(day), [day]);

  // A day with no rate gives the plume's density nothing to follow, so the
  // scene holds the rate of the last day that reported one, and the readout
  // says which. The column height and drift are still that day's own.
  const shownIndex = useMemo(
    () => lastReportedIndex(series, Math.min(selected, series.length - 1)),
    [series, selected],
  );
  const continuous = day.explosionsMax === null && day.phenomena.includes('continuousPhase');
  const heldFrom = day.explosionsMax === null && !continuous && shownIndex !== -1 ? series[shownIndex] : null;
  const sceneDay = useMemo(
    () => (heldFrom ? { ...day, explosionsMin: heldFrom.explosionsMin, explosionsMax: heldFrom.explosionsMax } : day),
    [day, heldFrom],
  );

  // Stable identity so selecting a day does not rebuild the terrain mesh.
  const onSelect = useCallback((i: number) => setSelected(i), []);

  return (
    <>
      <section className="hero">
        <Massif day={sceneDay} />

        <header className="topbar">
          <span className="brand">Fuego</span>
          <span className="observed">
            {isRepresentative && <span className="badge">Representative data</span>}
            {day.warnings.length > 0 && (
              <span className="badge" data-warn="true">
                {day.warnings.length} field{day.warnings.length > 1 ? 's' : ''} unread
              </span>
            )}
            {isToday ? 'Latest bulletin' : 'Replaying'} · {formatDate(day.date)}
          </span>
        </header>

        <aside className="readout">
          {rows.map((r) => (
            <div className="readout-row" key={r.key} data-lead={r.lead} data-missing={r.missing}>
              <span className="readout-k">{r.key}</span>
              <span className="readout-v">{r.value}<small>{r.unit}</small></span>
            </div>
          ))}
          {day.explosionsMax === null && !continuous && (
            <p className="readout-note" role="status">
              {heldFrom
                ? <>No explosion rate in this bulletin. The plume holds the rate of {formatDate(heldFrom.date)}, the last day that reported one.</>
                : <>No explosion rate in this bulletin, and none before it. The plume is drawn at a neutral rate.</>}
            </p>
          )}
        </aside>

        <div className="scrollcue" aria-hidden="true">
          <span>The record below drives the mountain</span>
        </div>
      </section>

      <section className="record">
        <div className="record-head">
          <div>
            <h2>Explosion tempo</h2>
            <p>
              Scrub the record and the mountain follows: the plume climbs to the ash column that
              day&rsquo;s bulletin reported, and leans the way the observer wrote down. The chart
              and the volcano are the same number, drawn twice.
            </p>
          </div>
          <dl className="figures">
            <div><dt>Days</dt><dd>{series.length}</dd></div>
            <div>
              <dt>Tallest column</dt>
              <dd>
                {figures.tallestColumn.value === null ? 'Not reported' : `${figures.tallestColumn.value.toLocaleString('en-GB')} m`}
                <small>over {figures.tallestColumn.days} of {series.length} days</small>
              </dd>
            </div>
            <div>
              <dt>Peak rate</dt>
              <dd>
                {figures.peakRate.value === null ? 'Not reported' : `${figures.peakRate.value} /hr`}
                <small>over {figures.peakRate.days} of {series.length} days</small>
              </dd>
            </div>
          </dl>
        </div>

        <TempoChart series={series} selected={selected} onSelect={onSelect} />
      </section>
    </>
  );
}
