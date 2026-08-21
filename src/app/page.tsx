import Massif from '@/components/Massif';
import TempoChart from '@/components/TempoChart';
import { IS_REPRESENTATIVE, demoSeries } from '@/lib/demo-series';

export default function Page() {
  // Once the archive has real days this reads data/index.json at build time.
  const series = demoSeries();
  const today = series[series.length - 1];

  const paroxysmIndex = series.reduce(
    (best, e, i) => ((e.explosionsMax ?? 0) > (series[best].explosionsMax ?? 0) ? i : best),
    0,
  );
  const daysSinceParoxysm = series.length - 1 - paroxysmIndex;
  const aboveSummit = (today.ashMaxMasl ?? 0) - 3763;

  return (
    <main>
      <section className="hero">
        <Massif activity={today.explosionsMax ?? 10} />

        <header className="topbar">
          <span className="brand">Fuego</span>
          <span className="observed">
            {IS_REPRESENTATIVE && <span className="badge">Representative data</span>}
            Observed {new Date(`${today.date}T00:00:00Z`).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', timeZone: 'UTC',
            })} · 07:30 CST
          </span>
        </header>

        {/* Direction B's readout column, kept in Ridgeline's palette. */}
        <aside className="readout">
          <Readout k="Explosions" v={`${today.explosionsMin}–${today.explosionsMax}`} u="per hour" lead />
          <Readout k="Ash column" v={(today.ashMaxMasl ?? 0).toLocaleString()} u="m asl" />
          <Readout k="Above summit" v={aboveSummit.toLocaleString()} u="m" />
          <Readout k="Drift" v={String(today.driftKm)} u={`km ${today.driftDirections.join('·')}`} />
          <Readout k="Since paroxysm" v={String(daysSinceParoxysm)} u="days" />
        </aside>

        <div className="scrollcue" aria-hidden="true">
          <span>Ninety days below</span>
        </div>
      </section>

      <section className="record">
        <div className="record-head">
          <div>
            <h2>Explosion tempo</h2>
            <p>
              Fuego does not stop. It pulses — six to fourteen times an hour on an ordinary day,
              then, every few weeks, it does something else entirely.
            </p>
          </div>
          <dl className="figures">
            <div><dt>Median</dt><dd>{median(series)} /hr</dd></div>
            <div><dt>Peak</dt><dd>{series[paroxysmIndex].explosionsMax} /hr</dd></div>
            <div><dt>Quiet days</dt><dd>{series.filter((e) => (e.explosionsMax ?? 0) === 0).length}</dd></div>
          </dl>
        </div>

        <TempoChart series={series} />

        <footer className="colophon">
          <p>
            Terrain from <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>,
            SRTM-derived and public domain — Fuego resolves to 3,771 m against a published 3,763 m.
            Vertical relief is exaggerated {'×'}1.55 so 2.9 km of it across 14 km reads the way
            it does from the ridge. Bulletins from{' '}
            <a href="https://insivumeh.gob.gt">INSIVUMEH</a>.
          </p>
        </footer>
      </section>
    </main>
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

function median(series: { explosionsMax: number | null }[]): number {
  const vals = series.map((e) => e.explosionsMax ?? 0).sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
}
