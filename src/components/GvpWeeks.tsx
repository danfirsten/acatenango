'use client';

import { useId, useMemo, useRef } from 'react';

import Mark from '@/components/ink/Mark';
import { StateMark, useWidth } from '@/components/TempoChart';
import { type Dict, formatNumber, formatShortDate, getDict, type Locale } from '@/i18n';
import { rich } from '@/i18n/rich';
import { PLOT_GUTTER, plotX } from '@/lib/readout';
import type { GvpCheck, GvpMark } from '@/lib/gvp';
import type { IndexEntry } from '../../scripts/build-index';

const H = 24;

function describe(c: GvpCheck, t: Dict): string {
  const g = t.gvp;
  const num = (n: number) => formatNumber(t.locale, n);
  const unit = c.field === 'explosions' ? g.perHour : g.mAsl;
  const range = (r: { min: number; max: number } | null) =>
    r === null ? g.notStated : g.range(num(r.min), r.min === r.max ? null : num(r.max), unit);
  const what = c.field === 'explosions' ? g.explosions : g.ashColumn;
  return g.check(what, range(c.gvp), range(c.bulletins));
}

interface Week { mark: GvpMark; first: number; last: number }

/**
 * A lane beside the field lanes, on the same axis: one line over each week the
 * Smithsonian GVP weekly report covers, and a quiet outline on a week where its
 * figures clearly disagree with the bulletins. Days with no GVP report are
 * hatched. Neither source is treated as the truth; the list below links both.
 * Until a week has been collected it folds to one line, so an empty lane never
 * takes room from the record.
 */
export default function GvpWeeks({ series, selected, locale }: { series: IndexEntry[]; selected: number; locale: Locale }) {
  const t = getDict(locale);
  const g = t.gvp;
  const short = (iso: string) => formatShortDate(locale, iso);
  const uid = useId();
  const hatch = `${uid}-hatch`;
  const ref = useRef<HTMLElement>(null);
  const W = useWidth(ref);
  const n = series.length;
  const dayX = (i: number) => plotX(i, n, W);
  const step = n > 1 ? dayX(1) - dayX(0) : W - PLOT_GUTTER;
  const cell = Math.max(step * 0.7, 1.5);

  const weeks = useMemo<Week[]>(() => {
    const out: Week[] = [];
    series.forEach((e, i) => {
      if (!e.gvp?.mark) return;
      let last = i;
      while (last + 1 < n && series[last + 1].gvp?.week === e.gvp.week) last += 1;
      out.push({ mark: e.gvp.mark, first: i, last });
    });
    return out;
  }, [series, n]);

  const covered = useMemo(() => new Set(weeks.flatMap((w) => Array.from({ length: w.last - w.first + 1 }, (_, k) => w.first + k))), [weeks]);
  const differing = weeks.filter((w) => w.mark.state === 'differ').reverse();
  const note = g.read(weeks.length, differing.length);

  const credit = (
    <p className="gvp-credit">
      {rich(g.credit, { gvp: <a href="https://volcano.si.edu/volcano.cfm?vn=342090">{g.programme}</a> })}
    </p>
  );

  if (weeks.length === 0) {
    return (
      <section className="gvp" id="gvp" aria-label={g.sectionLabel} data-folded="true" ref={ref}>
        <p className="gvp-fold">
          <span className="marked"><StateMark state="notReported" />{g.title}: {g.noneYet}.</span>
        </p>
        {credit}
      </section>
    );
  }

  return (
    <section className="gvp" id="gvp" aria-label={g.sectionLabel} ref={ref}>
      <div className="lane">
        <p className="lane-head"><span>{g.title}</span><span className="lane-note">{note}</span></p>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}
          role="img" aria-label={`${g.title}: ${note}`}>
          <defs>
            <pattern id={hatch} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" className="tempo-gap-hatch" />
            </pattern>
          </defs>
          {series.map((e, i) => covered.has(i) ? null : (
            <rect key={e.date} className="lane-missing" fill={`url(#${hatch})`}
              x={dayX(i) - cell / 2} width={cell} y={2} height={H - 4} />
          ))}
          {weeks.map((w) => {
            const x0 = dayX(w.first) - cell / 2;
            const x1 = dayX(w.last) + cell / 2;
            return (
              <g key={w.mark.week} data-state={w.mark.state}>
                <rect className="gvp-span" x={x0} width={x1 - x0} y={H / 2 - 1.5} height={3} />
                {w.mark.state === 'differ' && (
                  <rect className="gvp-differ" x={x0} width={x1 - x0} y={2} height={H - 4} />
                )}
              </g>
            );
          })}
          <line x1={dayX(selected)} x2={dayX(selected)} y1={0} y2={H} className="lane-sel" />
        </svg>
      </div>

      <p className="tempo-key">
        <span><StateMark state="notReported" />{g.keyMissing}</span>
        {differing.length > 0 && <span><Mark kind="ring" />{g.keyDiffer}</span>}
      </p>

      {differing.length === 0 ? (
        <p className="gvp-note">{g.agree}</p>
      ) : (
        <>
          <p className="gvp-note">{g.differIntro}</p>
          <ul className="gvp-list">
            {differing.map(({ mark }) => (
              <li key={mark.week}>
                <b>{g.week(short(mark.week), short(mark.end))}</b>
                {mark.checks.filter((c) => c.differs).map((c) => <span key={c.field}>{describe(c, t)}</span>)}
                <span className="gvp-links">
                  <a href={mark.url}>{g.report}</a>
                  <span>{g.bulletins}</span>
                  {mark.bulletins.map((b) => (
                    b.url ? <a key={b.date} href={b.url} aria-label={g.bulletinLabel(short(b.date))}>{short(b.date)}</a> : null
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {credit}
    </section>
  );
}
