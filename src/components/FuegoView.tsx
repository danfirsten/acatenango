'use client';

import { useCallback, useMemo, useState } from 'react';

import BulletinAge from '@/components/BulletinAge';
import Massif from '@/components/Massif';
import TempoChart from '@/components/TempoChart';
import { paroxysmIndex, readoutRows } from '@/lib/readout';
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

  const paroxysm = useMemo(() => paroxysmIndex(series), [series]);
  const rows = useMemo(() => readoutRows(day), [day]);

  // Stable identity so selecting a day does not rebuild the terrain mesh.
  const onSelect = useCallback((i: number) => setSelected(i), []);

  return (
    <>
      <section className="hero">
        <Massif day={day} />

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
            <div className="readout-row" key={r.key} data-lead={r.lead}>
              <span className="readout-k">{r.key}</span>
              <span className="readout-v">{r.value}<small>{r.unit}</small></span>
            </div>
          ))}
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
            <div><dt>Tallest column</dt><dd>{series[paroxysm].ashMaxMasl?.toLocaleString() ?? '—'} m</dd></div>
            <div><dt>Peak rate</dt><dd>{Math.max(...series.map((e) => e.explosionsMax ?? 0))} /hr</dd></div>
          </dl>
        </div>

        <TempoChart series={series} selected={selected} onSelect={onSelect} />
      </section>
    </>
  );
}
