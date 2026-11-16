'use client';

import { useCallback, useMemo, useState } from 'react';

import BulletinAge from '@/components/BulletinAge';
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

  // A day that left out its rate or column gives the plume nothing to follow,
  // so the scene holds the value from the last day that reported it, and the
  // readout says which. Whatever the day did report is drawn as its own.
  const at = Math.min(selected, series.length - 1);
  const continuous = day.explosionsMax === null && day.phenomena.includes('continuousPhase');
  const rateIndex = useMemo(() => lastReportedIndex(series, at), [series, at]);
  const columnIndex = useMemo(() => lastReportedIndex(series, at, (e) => e.ashMaxMasl), [series, at]);
  const rateFrom = day.explosionsMax === null && !continuous && rateIndex !== -1 ? series[rateIndex] : null;
  const columnFrom = day.ashMaxMasl === null && columnIndex !== -1 ? series[columnIndex] : null;
  const sceneDay = useMemo(
    () => ({
      ...day,
      ...(rateFrom && { explosionsMin: rateFrom.explosionsMin, explosionsMax: rateFrom.explosionsMax }),
      ...(columnFrom && { ashMinMasl: columnFrom.ashMinMasl, ashMaxMasl: columnFrom.ashMaxMasl }),
    }),
    [day, rateFrom, columnFrom],
  );
  const notes: string[] = [];
  const rateMissing = day.explosionsMax === null && !continuous;
  const columnMissing = day.ashMaxMasl === null;
  if (rateMissing && columnMissing && rateFrom && columnFrom && rateFrom === columnFrom) {
    notes.push(`No rate or ash column in this bulletin; the plume holds the rate and column of ${formatDate(rateFrom.date)}.`);
  } else {
    if (rateMissing) {
      notes.push(rateFrom
        ? `No explosion rate in this bulletin; the plume holds the rate of ${formatDate(rateFrom.date)}.`
        : 'No explosion rate in this bulletin or any before it.');
    }
    if (columnMissing) {
      notes.push(columnFrom
        ? `No ash column in this bulletin; the plume holds the height of ${formatDate(columnFrom.date)}.`
        : 'No ash column in this bulletin or any before it.');
    }
  }

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
            <span className="observed-text">
              <span className="observed-date">
                {isToday ? 'Latest bulletin' : 'Replaying'} · {formatDate(day.date)}
              </span>
              {isToday && <BulletinAge date={day.date} />}
            </span>
          </span>
        </header>

        <aside className="readout">
          {rows.map((r) => (
            <div className="readout-row" key={r.key} data-lead={r.lead} data-missing={r.missing}>
              <span className="readout-k">{r.key}</span>
              <span className="readout-v">{r.value}<small>{r.unit}</small></span>
            </div>
          ))}
          {notes.length > 0 && (
            <p className="readout-note" role="status">{notes.join(' ')}</p>
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
              <dd>{figures.tallestColumn.value === null ? 'Not reported' : `${figures.tallestColumn.value.toLocaleString('en-GB')} m`}</dd>
              <dd className="figures-note">{figures.tallestColumn.days} of {series.length} days</dd>
            </div>
            <div>
              <dt>Peak rate</dt>
              <dd>{figures.peakRate.value === null ? 'Not reported' : `${figures.peakRate.value} /hr`}</dd>
              <dd className="figures-note">{figures.peakRate.days} of {series.length} days</dd>
            </div>
          </dl>
        </div>

        <TempoChart series={series} selected={selected} onSelect={onSelect} />
      </section>
    </>
  );
}
