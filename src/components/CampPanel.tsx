import BulletinAge from '@/components/BulletinAge';
import { formatDate, formatNumber, getDict, type Locale } from '@/i18n';
import { rich } from '@/i18n/rich';
import { CAMP_BEARING_DEG, CAMP_DISTANCE_KM, compassPoint, describeCamp } from '@/lib/camp';
import type { IndexEntry } from '../../scripts/build-index';

interface CampPanelProps {
  /** The selected day: the latest bulletin unless the reader is replaying an earlier one. */
  entry: IndexEntry | null;
  /** Whether `entry` is the latest bulletin. */
  isLatest: boolean;
  isRepresentative: boolean;
  locale: Locale;
}

/**
 * The selected bulletin in hikers' terms: how often, how high, which way the ash
 * went relative to camp, and which towns took ash. Words come from the parsed
 * fields alone (src/lib/camp.ts); a field left out is said to be left out.
 *
 * It follows the day the record and the mountain show, so the page never
 * describes two days at once. That is the latest bulletin until the reader
 * scrubs back, and then the panel says it is replaying.
 */
export default function CampPanel({ entry, isLatest, isRepresentative, locale }: CampPanelProps) {
  const t = getDict(locale);
  const c = t.camp;
  const bearing = Math.round(CAMP_BEARING_DEG);
  const point = t.compass[compassPoint(CAMP_BEARING_DEG)];
  const km = formatNumber(locale, CAMP_DISTANCE_KM, 1);

  return (
    <section className="camp" aria-labelledby="camp-title" id="from-camp">
      <div className="camp-head">
        <h2 id="camp-title">{c.title}</h2>
        {entry ? (
          <p className="camp-date">
            {isRepresentative && <span className="badge">{c.representative}</span>}{' '}
            {!isLatest && <><span className="badge" data-replaying="true">{t.topbar.replaying}</span>{' '}</>}
            {rich(c.bulletinOf, { date: <time dateTime={entry.date}>{formatDate(locale, entry.date)}</time> })}
            {isLatest && <BulletinAge date={entry.date} locale={locale} />}
          </p>
        ) : null}
      </div>

      {entry ? <CampBody entry={entry} locale={locale} /> : <p className="camp-empty">{c.empty}</p>}

      <div className="camp-foot">
        <p>{c.foot(km, bearing, point)}</p>
        <p className="camp-advice">
          {rich(c.advice, {
            notice: <a href="#notice">{c.noticeLink}</a>,
            insivumeh: <a href="https://insivumeh.gob.gt/vulcanologia/">INSIVUMEH</a>,
            conred: <a href="https://conred.gob.gt/alertas/">CONRED</a>,
          })}
        </p>
      </div>
    </section>
  );
}

function CampBody({ entry, locale }: { entry: IndexEntry; locale: Locale }) {
  const { summary, lines } = describeCamp(entry, getDict(locale));
  return (
    <div className="camp-body">
      <p className="camp-summary">{summary}</p>
      <dl className="camp-lines">
        {lines.map((l) => (
          <div className="camp-line" key={l.key} data-missing={l.missing}>
            <dt>{l.label}</dt>
            <dd>{l.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
