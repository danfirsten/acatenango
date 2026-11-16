'use client';

import { useId, useMemo } from 'react';

import { AXIS_W as W, dayX } from '@/lib/fields';
import type { GvpCheck, GvpMark } from '@/lib/gvp';
import type { IndexEntry } from '../../scripts/build-index';

const H = 22;

const short = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const range = (r: { min: number; max: number } | null, unit: string) =>
  r === null ? 'not stated' : `${r.min === r.max ? r.min.toLocaleString('en-GB') : `${r.min.toLocaleString('en-GB')} to ${r.max.toLocaleString('en-GB')}`} ${unit}`;

function describe(c: GvpCheck): string {
  const unit = c.field === 'explosions' ? 'per hour' : 'm above sea level';
  const what = c.field === 'explosions' ? 'Explosions' : 'Ash column';
  return `${what}: GVP ${range(c.gvp, unit)}; bulletins ${range(c.bulletins, unit)}`;
}

interface Week { mark: GvpMark; first: number; last: number }

/**
 * A lane beside the field lanes, on the same axis: one line over each week the
 * Smithsonian GVP weekly report covers, and a quiet ring on a week where its
 * figures clearly disagree with the bulletins. Days with no GVP report are
 * hatched. Neither source is treated as the truth; the list below links both.
 */
export default function GvpWeeks({ series, selected }: { series: IndexEntry[]; selected: number }) {
  const uid = useId();
  const hatch = `${uid}-hatch`;
  const n = series.length;
  const step = n > 1 ? W / (n - 1) : W;
  const cell = Math.max(step * 0.8, 1.4);

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
  const note = weeks.length === 0
    ? 'no weekly reports collected yet'
    : `${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'} read · ${differing.length} differ`;

  return (
    <section className="gvp" aria-label="Smithsonian weekly report cross-check">
      <div className="lane">
        <p className="lane-head"><span>Smithsonian weekly report</span><span className="lane-note">{note}</span></p>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ aspectRatio: `${W} / ${H}` }}
          role="img" aria-label={`Smithsonian weekly report: ${note}`}>
          <defs>
            <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="tempo-gap-hatch" />
            </pattern>
          </defs>
          {series.map((e, i) => covered.has(i) ? null : (
            <rect key={e.date} className="lane-missing" fill={`url(#${hatch})`}
              x={dayX(i, n) - cell / 2} width={cell} y={2} height={H - 4} />
          ))}
          {weeks.map((w) => {
            const x0 = dayX(w.first, n) - cell / 2;
            const x1 = dayX(w.last, n) + cell / 2;
            return (
              <g key={w.mark.week} data-state={w.mark.state}>
                <rect className="gvp-span" x={x0} width={x1 - x0} y={H / 2 - 1.5} height={3} />
                {w.mark.state === 'differ' && (
                  <circle className="gvp-differ" cx={(x0 + x1) / 2} cy={H / 2} r={6} />
                )}
              </g>
            );
          })}
          <line x1={dayX(selected, n)} x2={dayX(selected, n)} y1={0} y2={H} className="lane-sel" />
        </svg>
      </div>

      <p className="tempo-key">
        <span><span className="tempo-key-swatch" aria-hidden="true" />No GVP report collected for the week</span>
        {differing.length > 0 && <span><span className="gvp-key-ring" aria-hidden="true" />The two sources differ</span>}
      </p>

      {weeks.length === 0 ? (
        <p className="gvp-note">
          The Smithsonian Global Volcanism Program writes a weekly report on Fuego from the same
          observatory reports. Once its weeks are collected, any week where its figures clearly
          disagree with the bulletins is marked here.
        </p>
      ) : differing.length === 0 ? (
        <p className="gvp-note">No week has figures that clearly disagree with the bulletins.</p>
      ) : (
        <>
          <p className="gvp-note">
            In these weeks the report&rsquo;s figures and the bulletins&rsquo; figures sit clearly apart. That
            can be a misread scan, a slip in the parser or a difference in what each source counts.
            Neither is taken as right, and nothing here has been corrected.
          </p>
          <ul className="gvp-list">
            {differing.map(({ mark }) => (
              <li key={mark.week}>
                <b>{short(mark.week)} to {short(mark.end)}</b>
                {mark.checks.filter((c) => c.differs).map((c) => <span key={c.field}>{describe(c)}</span>)}
                <span className="gvp-links">
                  <a href={mark.url}>GVP weekly report</a>
                  <span>INSIVUMEH bulletins:</span>
                  {mark.bulletins.map((b) => (
                    b.url ? <a key={b.date} href={b.url} aria-label={`INSIVUMEH bulletin, ${short(b.date)}`}>{short(b.date)}</a> : null
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="gvp-credit">
        Weekly figures from the{' '}
        <a href="https://volcano.si.edu/volcano.cfm?vn=342090">Smithsonian Institution Global Volcanism Program</a>,
        Weekly Volcanic Activity Reports for Fuego.
      </p>
    </section>
  );
}
