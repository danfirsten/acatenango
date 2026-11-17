import CampPanel from '@/components/CampPanel';
import FuegoView from '@/components/FuegoView';
import LanguageSwitch from '@/components/LanguageSwitch';
import Notice from '@/components/Notice';
import { formatDate, formatNumber, getDict, type Locale } from '@/i18n';
import { rich } from '@/i18n/rich';
import { latestEntry } from '@/lib/camp';
import { loadSeries } from '@/lib/series';

/**
 * The whole page in one language. `/` renders it in English and `/es/` in
 * Spanish; both are static and show the same record.
 */
export default function FuegoPage({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const { series, isRepresentative, completeness, firstDate, lastDate } = loadSeries();
  const num = (n: number) => formatNumber(locale, n);

  return (
    <main>
      <Notice locale={locale} />
      <FuegoView series={series} isRepresentative={isRepresentative} locale={locale} />
      <CampPanel entry={latestEntry(series)} isRepresentative={isRepresentative} locale={locale} />

      <section className="record record-foot">
        <footer className="colophon" id="colophon">
          <p>
            {rich(t.colophon.terrain(num(3771), num(3763), num(1.55), num(2.9), num(14)), {
              aws: <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>,
            })}
          </p>
          <p>
            {isRepresentative || firstDate === null || lastDate === null ? (
              t.colophon.representative
            ) : (
              <>
                {rich(t.colophon.record(series.length, formatDate(locale, firstDate), formatDate(locale, lastDate)), {
                  insivumeh: <a href="https://insivumeh.gob.gt">INSIVUMEH</a>,
                })}
                {completeness.map((c) => (
                  <span key={c.field}>
                    {' '}{t.colophon.completeness(t.colophon.field[c.field], c.reported, c.total, c.continuous ?? 0)}
                  </span>
                ))}
                {' '}{t.colophon.rawKept}
              </>
            )}
          </p>
          <p className="colophon-lang"><LanguageSwitch locale={locale} /></p>
        </footer>
      </section>
    </main>
  );
}
