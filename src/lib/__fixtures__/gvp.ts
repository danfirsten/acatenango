/**
 * Weekly report pages in the layout volcano.si.edu uses for Fuego: a heading,
 * "Report for <start>-<end>", the report text, then "Sources:".
 *
 * They are written to match that layout, not captured from the live site (it
 * was unreachable when they were made). Replace them with captured pages when
 * the collector first runs in Actions; the tests will say what no longer holds.
 */

const page = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en"><head><title>Fuego | Weekly Volcanic Activity Report</title>
<style>.x { color: red }</style><script>var tracking = 1;</script></head>
<body><nav>Home Volcanoes Reports</nav>
<h1>Fuego</h1>
<h2>${title}</h2>
${body}
<p>Sources: Coordinadora Nacional para la Reducci&oacute;n de Desastres (CONRED); Instituto Nacional de Sismolog&iacute;a, Vulcanolog&iacute;a, Meteorolog&iacute;a e Hidrolog&iacute;a (INSIVUMEH)</p>
<h3>Geologic Background</h3><p>Volc&aacute;n de Fuego, one of Central America's most active volcanoes.</p>
</body></html>`;

/** Rate and altitude both stated; ranges sit inside a plausible bulletin week. */
export const WEEK_TYPICAL = page(
  'Report for 5 November-11 November 2025',
  `<p>INSIVUMEH reported that during 5-11 November explosions at Fuego's Crater Arenas were recorded at a rate
of 4-8 explosions per hour. Ash plumes rose 4.5-4.8 km (14,800-15,700 ft) a.s.l. and drifted 10-15 km W and SW.
Avalanches descended the Seca and Ceniza drainages.</p>`,
);

/** A week whose figures a parser or OCR slip would sit far from. */
export const WEEK_FAR = page(
  'Report for 12 November-18 November 2025',
  `<p>INSIVUMEH reported that explosions at Fuego occurred at a rate of 14-20 explosions per hour. Plumes rose
to an altitude of 6.2 km a.s.l.</p>`,
);

/** Heights given only above the crater, and no rate: neither is invented. */
export const WEEK_RELATIVE = page(
  'Report for 19 November-25 November 2025',
  `<p>INSIVUMEH reported that explosions generated plumes that rose 1.1-1.5 km above the crater rim and
drifted W. Incandescent material was ejected 200-300 m high.</p>`,
);

/** Plume altitude in metres and a single-figure rate. */
export const WEEK_METRES = page(
  'Report for 26 November-2 December 2025',
  `<p>Explosions were recorded at 6 explosions per hour; ash plumes reached 4,500-4,700 m a.s.l. (14,800-15,400 ft).</p>`,
);

/** A different week served at this address. */
export const WRONG_WEEK = WEEK_FAR;

export const NO_REPORT = `<html><body><h1>Fuego</h1><p>There are no reports for this period.</p></body></html>`;
