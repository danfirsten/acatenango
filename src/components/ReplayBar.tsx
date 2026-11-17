'use client';

import Pill from '@/components/ink/Pill';
import { formatDate, formatShortDate, getDict, type Locale } from '@/i18n';

interface ReplayBarProps {
  /** Every day's date, oldest first. */
  dates: string[];
  /** The selected day's index. The bar shows only while it is not the latest. */
  selected: number;
  onSelect: (index: number) => void;
  locale: Locale;
}

/** Hands focus back to the record's scrub once the bar has gone. */
function focusScrub() {
  requestAnimationFrame(() => document.getElementById('record-scrub')?.focus({ preventScroll: true }));
}

/**
 * Pinned to the bottom while an earlier bulletin is shown: the previous day,
 * the date, the next day, and a solid "Back to <latest>". Returning to the
 * latest day removes it, so the page reads as replay only while it is one.
 */
export default function ReplayBar({ dates, selected, onSelect, locale }: ReplayBarProps) {
  const latest = dates.length - 1;
  if (latest < 0 || selected >= latest) return null;
  const t = getDict(locale).replay;
  const day = dates[selected];

  const go = (i: number) => {
    onSelect(i);
    // Stepping onto the latest day removes the bar and the button with it.
    if (i === latest) focusScrub();
  };

  return (
    <div className="replay-bar" role="region" aria-label={t.label}>
      <button type="button" className="pill pill-line press replay-step" aria-label={t.previous}
        disabled={selected === 0} onClick={() => go(selected - 1)}>
        <span aria-hidden="true">‹</span>
      </button>
      <time className="replay-date num" dateTime={day} aria-live="polite">
        <span className="replay-date-short" aria-hidden="true">{formatShortDate(locale, day)}</span>
        <span className="sr-only">{formatDate(locale, day)}</span>
      </time>
      <button type="button" className="pill pill-line press replay-step" aria-label={t.next}
        onClick={() => go(selected + 1)}>
        <span aria-hidden="true">›</span>
      </button>
      <Pill onClick={() => go(latest)}>{t.back(formatShortDate(locale, dates[latest]))}</Pill>
    </div>
  );
}
