'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import BulletinAge from '@/components/BulletinAge';
import FieldLanes from '@/components/FieldLanes';
import GvpWeeks from '@/components/GvpWeeks';
import LanguageSwitch from '@/components/LanguageSwitch';
import Massif from '@/components/Massif';
import TempoChart from '@/components/TempoChart';
import { formatDate, formatNumber, getDict, LOCALE_PATH, type Locale } from '@/i18n';
import { withBase } from '@/lib/base-path';
import { rememberedLanguage, scrollToPlace, takePlace } from '@/lib/place';
import { lastReportedIndex, readoutRows, summaryFigures } from '@/lib/readout';
import type { IndexEntry } from '../../scripts/build-index';

interface FuegoViewProps {
  series: IndexEntry[];
  isRepresentative: boolean;
  locale: Locale;
}

/**
 * Holds the selected day. Scrubbing the record drives both the readout and the
 * 3D plume, so the chart and the volcano are two views of the same number.
 */
export default function FuegoView({ series, isRepresentative, locale }: FuegoViewProps) {
  const t = getDict(locale);
  const date = (iso: string) => formatDate(locale, iso);
  const [selected, setSelected] = useState(series.length - 1);
  const day = series[Math.min(selected, series.length - 1)];
  const isToday = selected === series.length - 1;

  const figures = useMemo(() => summaryFigures(series), [series]);
  const rows = useMemo(() => readoutRows(day, t), [day, t]);

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
    notes.push(t.notes.bothHeld(date(rateFrom.date)));
  } else {
    if (rateMissing) notes.push(rateFrom ? t.notes.rateHeld(date(rateFrom.date)) : t.notes.rateNone);
    if (columnMissing) notes.push(columnFrom ? t.notes.columnHeld(date(columnFrom.date)) : t.notes.columnNone);
  }

  // Stable identity so selecting a day does not rebuild the terrain mesh.
  const onSelect = useCallback((i: number) => setSelected(i), []);

  // Arriving from the other language: open on the reader's chosen language if
  // they chose one, and pick up where they were (the replayed day, the section).
  useEffect(() => {
    const chosen = rememberedLanguage();
    if (chosen !== null && chosen !== locale) {
      window.location.replace(withBase(LOCALE_PATH[chosen]) + window.location.hash);
      return;
    }
    const place = takePlace();
    if (place === null) return;
    const i = place.day === null ? -1 : series.findIndex((e) => e.date === place.day);
    // Next frame, so the effect never sets state synchronously; the scroll waits
    // one more frame for the selected day's layout.
    requestAnimationFrame(() => {
      if (i !== -1) onSelect(i);
      requestAnimationFrame(() => scrollToPlace(place));
    });
  }, [locale, series, onSelect]);

  return (
    <>
      <section className="hero">
        <Massif day={sceneDay} locale={locale} />

        <header className="topbar">
          <span className="brand">Fuego</span>
          <span className="observed" data-selected-day={day.date}>
            {isRepresentative && <span className="badge">{t.topbar.representative}</span>}
            {day.warnings.length > 0 && (
              <span className="badge" data-warn="true">{t.topbar.unread(day.warnings.length)}</span>
            )}
            <span className="observed-text">
              <span className="observed-date">
                {isToday ? t.topbar.latest : t.topbar.replaying} · {date(day.date)}
              </span>
              {isToday && <BulletinAge date={day.date} locale={locale} />}
            </span>
            <LanguageSwitch locale={locale} />
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
          <span>{t.scrollcue}</span>
        </div>
      </section>

      <section className="record" id="record">
        <div className="record-head">
          <div>
            <h2>{t.record.title}</h2>
            <p>{t.record.intro}</p>
          </div>
          <dl className="figures">
            <div><dt>{t.record.days}</dt><dd>{series.length}</dd></div>
            <div>
              <dt>{t.record.tallest}</dt>
              <dd>{figures.tallestColumn.value === null ? t.record.notReported : `${formatNumber(locale, figures.tallestColumn.value)} m`}</dd>
              <dd className="figures-note">{t.record.daysOf(figures.tallestColumn.days, series.length)}</dd>
            </div>
            <div>
              <dt>{t.record.peakRate}</dt>
              <dd>{figures.peakRate.value === null ? t.record.notReported : t.record.perHour(formatNumber(locale, figures.peakRate.value))}</dd>
              <dd className="figures-note">{t.record.daysOf(figures.peakRate.days, series.length)}</dd>
            </div>
          </dl>
        </div>

        <TempoChart series={series} selected={selected} onSelect={onSelect} locale={locale} />
        <FieldLanes series={series} selected={selected} onSelect={onSelect} locale={locale} />
        <GvpWeeks series={series} selected={selected} locale={locale} />
      </section>
    </>
  );
}
