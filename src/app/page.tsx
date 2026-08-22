import FuegoView from '@/components/FuegoView';
import { loadSeries } from '@/lib/series';

export default function Page() {
  const { series, isRepresentative, daysWithWarnings, firstDate, lastDate } = loadSeries();

  return (
    <main>
      <FuegoView series={series} isRepresentative={isRepresentative} />

      <section className="record record-foot">
        <footer className="colophon">
          <p>
            Terrain from{' '}
            <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>,
            SRTM-derived and public domain — Fuego resolves to 3,771 m against a published
            3,763 m. Vertical relief is exaggerated {'×'}1.55 so 2.9 km of it across 14 km reads
            the way it does from the ridge.
          </p>
          <p>
            {isRepresentative ? (
              <>The series shown is representative pending a fuller archive.</>
            ) : (
              <>
                {series.length} bulletins from{' '}
                <a href="https://insivumeh.gob.gt">INSIVUMEH</a>, {firstDate} to {lastDate},
                read out of scanned PDFs by OCR. The parser failed to read a printed value on{' '}
                {daysWithWarnings === 0 ? 'none of them' : `${daysWithWarnings} of them`}; every
                bulletin&rsquo;s raw text is kept, so improving the parser re-derives the whole
                record without re-fetching anything.
              </>
            )}
          </p>
        </footer>
      </section>
    </main>
  );
}
