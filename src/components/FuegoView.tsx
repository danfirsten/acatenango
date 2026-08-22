'use client';

import { useCallback, useMemo, useState } from 'react';

import Massif from '@/components/Massif';
import TempoChart from '@/components/TempoChart';
import type { IndexEntry } from '../../scripts/build-index';

/** Fuego's summit — the datum an ash column height is quoted against. */
const SUMMIT_M = 3763;

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

  const paroxysm = useMemo(
    () => series.reduce(
      (best, e, i) => ((e.ashMaxMasl ?? 0) > (series[best].ashMaxMasl ?? 0) ? i : best),
      0,
    ),
    [series],
  );

  // Stable identity so selecting a day does not rebuild the terrain mesh.
  const onSelect = useCallback((i: number) => setSelected(i), []);

  const aboveSummit = day.ashMaxMasl === null ? null : day.ashMaxMasl - SUMMIT_M;
  const continuous = day.phenomena.includes('continuousPhase');

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
            {isToday ? 'Latest bulletin' : 'Replaying'} · {formatDate(day.date)}
          </span>
        </header>

        <aside className="readout">
          <Readout
            k="Explosions"
            v={day.explosionsMax === null
              ? (continuous ? 'continuous' : '—')
              : `${day.explosionsMin}–${day.explosionsMax}`}
            u={day.explosionsMax === null ? (continuous ? 'emission' : 'not reported') : 'per hour'}
            lead
          />
          <Readout k="Ash column" v={day.ashMaxMasl?.toLocaleString() ?? '—'} u="m asl" />
          <Readout k="Above summit" v={aboveSummit?.toLocaleString() ?? '—'} u="m" />
          <Readout
            k="Drift"
            v={day.driftKm === null ? '—' : String(day.driftKm)}
            u={
              day.driftKm === null
                ? (day.driftDirections.join('·') || 'not reported')
                : `km ${day.driftDirections.join('·')}`
            }
          />
          <Readout k="Drainages" v={String(day.drainages.length)} u={day.drainages.join(', ') || 'none named'} />
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

function Readout({ k, v, u, lead }: { k: string; v: string; u: string; lead?: boolean }) {
  return (
    <div className="readout-row" data-lead={lead}>
      <span className="readout-k">{k}</span>
      <span className="readout-v">{v}<small>{u}</small></span>
    </div>
  );
}
