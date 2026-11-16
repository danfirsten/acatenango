import type { IndexEntry } from '../../scripts/build-index';

/**
 * Placeholder series, used only until OCR lands and the archive has real days.
 *
 * The ranges are real — 6–14 explosions an hour is Fuego's ordinary tempo, and
 * the 3–5 August paroxysm really did run past fifty hours — but the day-by-day
 * values are generated. Anything rendering this must say so; the UI carries a
 * "representative" badge for exactly that reason.
 *
 * Deterministic so the server and client render identically.
 */

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export const IS_REPRESENTATIVE = true;

export function demoSeries(days = 90, endISO = '2026-08-21'): IndexEntry[] {
  const rand = seeded(20260821);
  const end = new Date(`${endISO}T00:00:00Z`);

  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (days - 1 - i));
    const back = (end.getTime() - d.getTime()) / 86_400_000;

    let base = 6 + rand() * 8;
    if (back >= 16 && back <= 18) base = 34 + rand() * 13;        // the paroxysm
    else if (back >= 14 && back <= 20) base = 16 + rand() * 9;    // its shoulders
    else if (back >= 52 && back <= 55) base = 19 + rand() * 7;

    const max = Math.round(base);
    const min = Math.max(1, Math.round(base * (0.62 + rand() * 0.16)));
    const ash = Math.round(4200 + (max / 47) * 900 + rand() * 120);

    return {
      date: d.toISOString().slice(0, 10),
      explosionsMin: min,
      explosionsMax: max,
      ashMinMasl: ash - 180,
      ashMaxMasl: ash,
      driftKm: Math.round(8 + (max / 47) * 34),
      driftDirections: ['W', 'SW'],
      incandescenceMinM: 100,
      incandescenceMaxM: 150 + Math.round(max * 6),
      drainages: max > 24 ? ['Seca', 'Ceniza', 'Taniluyá'] : ['Seca', 'Ceniza'],
      lavaFlowM: max > 30 ? 1200 : null,
      phenomena: ['explosions', 'degassing', 'incandescence'],
      ashfallCommunities: [],
      warnings: [],
    };
  });
}
