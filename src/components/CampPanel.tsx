import BulletinAge from '@/components/BulletinAge';
import {
  CAMP_BEARING_DEG,
  CAMP_DISTANCE_KM,
  COMPASS_WORD,
  compassPoint,
  describeCamp,
  formatBulletinDate,
} from '@/lib/camp';
import type { IndexEntry } from '../../scripts/build-index';

interface CampPanelProps {
  /** The latest bulletin: the day the mountain above opens on. */
  entry: IndexEntry | null;
  isRepresentative: boolean;
}

/**
 * The latest bulletin in hikers' terms: how often, how high, which way the ash
 * went relative to camp, and which towns took ash. Words come from the parsed
 * fields alone (src/lib/camp.ts); a field left out is said to be left out.
 */
export default function CampPanel({ entry, isRepresentative }: CampPanelProps) {
  const bearing = Math.round(CAMP_BEARING_DEG);
  const point = COMPASS_WORD[compassPoint(CAMP_BEARING_DEG)];

  return (
    <section className="camp" aria-labelledby="camp-title" id="from-camp">
      <div className="camp-head">
        <h2 id="camp-title">From camp</h2>
        {entry ? (
          <p className="camp-date">
            {isRepresentative && <span className="badge">Representative data</span>}{' '}
            Bulletin of <time dateTime={entry.date}>{formatBulletinDate(entry.date)}</time>
            <BulletinAge date={entry.date} />
          </p>
        ) : null}
      </div>

      {entry ? <CampBody entry={entry} /> : (
        <p className="camp-empty">
          No bulletin has been archived yet. When the first one is read, what it reported will be
          described here as it reads from Acatenango.
        </p>
      )}

      <div className="camp-foot">
        <p>
          Camp is taken at Acatenango&rsquo;s summit, {CAMP_DISTANCE_KM.toFixed(1)} km from Fuego&rsquo;s
          crater on a bearing of {bearing}&deg;, roughly {point}. Ash drifting within a quarter of the
          compass of that bearing is described as toward Acatenango, the opposite quarter as away,
          and the rest as to one side.
        </p>
        <p className="camp-advice">
          This describes what the bulletin reported. It is not advice on whether to climb or camp:
          read the <a href="#notice">notice at the top</a>, and see{' '}
          <a href="https://insivumeh.gob.gt/vulcanologia/">INSIVUMEH</a> and{' '}
          <a href="https://conred.gob.gt/alertas/">CONRED</a> for alerts.
        </p>
      </div>
    </section>
  );
}

function CampBody({ entry }: { entry: IndexEntry }) {
  const { summary, lines } = describeCamp(entry);
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
