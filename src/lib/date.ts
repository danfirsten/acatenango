/** Guatemala is UTC-6 year-round; it does not observe DST. */
const GUATEMALA_UTC_OFFSET_HOURS = -6;

/** The local Guatemala calendar date for an instant, as YYYY-MM-DD. */
export function guatemalaDate(instant: Date = new Date()): string {
  const shifted = new Date(
    instant.getTime() + GUATEMALA_UTC_OFFSET_HOURS * 3600_000,
  );
  return shifted.toISOString().slice(0, 10);
}
