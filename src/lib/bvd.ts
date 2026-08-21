/**
 * INSIVUMEH publishes the Boletín Vulcanológico Diario at a deterministic,
 * date-addressable URL:
 *
 *   /wp-content/uploads/{YYYY}/{MM}/BVD-{YYYY}-{MM}-{DD}.pdf
 *
 * Their own site JS probes this pattern over the last few days rather than
 * linking bulletins explicitly, which is why nothing useful appears in the
 * page markup. Addressing it directly is both simpler and far more reliable
 * than scraping — and it makes historical backfill a matter of iterating dates.
 */

const ORIGIN = 'https://insivumeh.gob.gt';

/** The bulletin URL for a Guatemala-local calendar date (YYYY-MM-DD). */
export function bvdUrl(date: string): string {
  const [y, m, d] = date.split('-');
  return `${ORIGIN}/wp-content/uploads/${y}/${m}/BVD-${y}-${m}-${d}.pdf`;
}

/** Calendar dates counting back from `date`, most recent first. */
export function recentDates(date: string, days: number): string[] {
  const out: string[] = [];
  const start = new Date(`${date}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
