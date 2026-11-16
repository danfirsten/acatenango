import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  MALFORMED,
  PAROXYSM,
  QUIET,
  TYPICAL,
} from './__fixtures__/bulletins';
import { BVD_2026_08_21_FUEGO } from './__fixtures__/bvd-2026-08-21-page2';
import { cleanOcrText } from './ocr';
import { PARSER_VERSION } from './bulletin';
import { parseBulletin, parseSpanishNumber } from './parse-bulletin';

describe('parseSpanishNumber', () => {
  it('reads grouped thousands with either separator', () => {
    assert.equal(parseSpanishNumber('4,500'), 4500);
    assert.equal(parseSpanishNumber('4.500'), 4500);
    assert.equal(parseSpanishNumber('1,200'), 1200);
  });

  it('reads decimals with either separator', () => {
    assert.equal(parseSpanishNumber('1.1'), 1.1);
    assert.equal(parseSpanishNumber('1,1'), 1.1);
  });

  it('reads bare integers and rejects non-numbers', () => {
    assert.equal(parseSpanishNumber('40'), 40);
    assert.equal(parseSpanishNumber('n/a'), null);
    assert.equal(parseSpanishNumber(''), null);
  });
});

describe('parseBulletin — typical day', () => {
  const { parsed, warnings } = parseBulletin(TYPICAL);

  it('extracts the explosion rate range', () => {
    assert.deepEqual(parsed.explosionsPerHour, { min: 5, max: 8 });
  });

  it('reads the ash column, not the degassing altitude', () => {
    assert.deepEqual(parsed.ashColumnMasl, { min: 4500, max: 4800 });
  });

  it('extracts drift direction and distance', () => {
    assert.deepEqual(parsed.driftDirections.sort(), ['SW', 'W']);
    assert.equal(parsed.driftKm, 15);
  });

  it('does not mistake the word "ceniza" for the barranca of that name', () => {
    // Both appear in this bulletin; only the drainage clause should count.
    assert.deepEqual(parsed.drainages, ['Seca', 'Ceniza', 'Trinidad', 'Las Lajas']);
  });

  it('extracts incandescence as a range', () => {
    assert.deepEqual(parsed.incandescenceM, { min: 200, max: 300 });
  });

  it('identifies phenomena', () => {
    for (const p of ['explosions', 'rumbling', 'shockwaves', 'avalanches', 'degassing', 'incandescence']) {
      assert.ok(parsed.phenomena.includes(p as never), `expected ${p}`);
    }
  });

  it('reports no warnings on a well-formed bulletin', () => {
    assert.deepEqual(warnings, []);
  });
});

describe('parseBulletin — paroxysm', () => {
  const { parsed } = parseBulletin(PAROXYSM);

  it('handles "entre X y Y" phrasing', () => {
    assert.deepEqual(parsed.explosionsPerHour, { min: 12, max: 16 });
  });

  it('handles dot-grouped thousands in the ash column', () => {
    assert.deepEqual(parsed.ashColumnMasl, { min: 4700, max: 5200 });
  });

  it('extracts the lava flow length', () => {
    assert.equal(parsed.lavaFlowM, 1200);
  });

  it('matches barranca names without accents', () => {
    assert.ok(parsed.drainages.includes('Taniluyá'));
    assert.ok(parsed.drainages.includes('Las Lajas'));
    assert.ok(parsed.drainages.includes('El Jute'));
  });

  it('flags lahars and ashfall', () => {
    assert.ok(parsed.phenomena.includes('lahars'));
    assert.ok(parsed.phenomena.includes('ashfall'));
    assert.ok(parsed.phenomena.includes('lavaFlow'));
  });

  it('reads long-range drift', () => {
    assert.equal(parsed.driftKm, 40);
    assert.deepEqual(parsed.driftDirections, ['SW']);
  });
});

describe('parseBulletin — quiet day', () => {
  const { parsed, warnings } = parseBulletin(QUIET);

  it('treats a single figure as a degenerate range', () => {
    assert.deepEqual(parsed.explosionsPerHour, { min: 1, max: 1 });
  });

  it('does not warn about fields the bulletin never printed', () => {
    // A warning must mean "the parser failed", not "the observer stayed quiet".
    assert.deepEqual(warnings, []);
  });
});

describe('parseBulletin — degradation', () => {
  it('returns nulls rather than throwing, and blames nobody', () => {
    // "sin datos disponibles por falla en la estación sísmica" — the station
    // failed, not the parser, so there is nothing here to warn about.
    const { parsed, warnings } = parseBulletin(MALFORMED);
    assert.equal(parsed.explosionsPerHour, null);
    assert.equal(parsed.ashColumnMasl, null);
    assert.deepEqual(warnings, []);
  });

  it('survives empty input', () => {
    const { parsed, warnings } = parseBulletin('');
    assert.equal(parsed.explosionsPerHour, null);
    assert.deepEqual(parsed.drainages, []);
    assert.ok(warnings.includes('empty-bulletin-text'));
  });

  it('rejects an ash column below the summit as a misparse', () => {
    const { warnings } = parseBulletin(
      'columnas de ceniza a una altura de 1,200 msnm',
    );
    assert.ok(warnings.includes('ash-column-below-summit'));
  });
});

describe('parseBulletin — the real 21 August 2026 bulletin', () => {
  // Verbatim tesseract output from the scanned PDF, not a reconstruction.
  const { parsed, warnings } = parseBulletin(BVD_2026_08_21_FUEGO);

  it('reads the explosion rate INSIVUMEH published', () => {
    assert.deepEqual(parsed.explosionsPerHour, { min: 6, max: 9 });
  });

  it('reads the ash column, not the summit elevation in the sidebar', () => {
    // The same page prints "Altura: 3763 msnm" for the volcano itself.
    assert.deepEqual(parsed.ashColumnMasl, { min: 4200, max: 4700 });
  });

  it('reads dispersal direction and distance', () => {
    assert.deepEqual([...parsed.driftDirections].sort(), ['NW', 'W']);
    assert.equal(parsed.driftKm, 30);
  });

  it('matches "Lajas" as printed, without the leading "Las"', () => {
    assert.deepEqual(parsed.drainages, ['Seca', 'Ceniza', 'Las Lajas']);
  });

  it('reads the sky from the sidebar', () => {
    assert.equal(parsed.sky, 'clear');
  });

  it('identifies the reported phenomena', () => {
    for (const p of ['explosions', 'rumbling', 'shockwaves', 'avalanches', 'ashfall', 'lahars', 'incandescence']) {
      assert.ok(parsed.phenomena.includes(p as never), `expected ${p}`);
    }
  });

  it('parses a real scan with no warnings at all', () => {
    assert.deepEqual(warnings, []);
  });
});

describe('sky parsing', () => {
  it('does not read "parcialmente nublado" as "nublado"', () => {
    assert.equal(
      parseBulletin('Condiciones atmosféricas: Parcialmente nublado').parsed.sky,
      'partlyCloudy',
    );
  });

  it('ignores cloud mentioned in the activity prose', () => {
    // Only the bulletin's own labelled field counts as the day's sky.
    assert.equal(
      parseBulletin('la nubosidad limita la observación de las barrancas').parsed.sky,
      null,
    );
  });
});

describe('explosion rate phrasings seen in real bulletins', () => {
  it('reads numbers that come before the noun', () => {
    assert.deepEqual(
      parseBulletin('reporta entre 6 y 9 explosiones por hora, de intensidad débil').parsed.explosionsPerHour,
      { min: 6, max: 9 },
    );
  });

  it('reads a rate detached from the noun by qualifiers', () => {
    // 20 Aug 2026 phrased it this way and the first parser missed it entirely.
    assert.deepEqual(
      parseBulletin(
        'Se registran explosiones débiles, moderadas y fuertes, a un ritmo de 2 a 6 por hora, generando columna',
      ).parsed.explosionsPerHour,
      { min: 2, max: 6 },
    );
  });

  it('does not mistake a nearby altitude for a rate', () => {
    assert.equal(
      parseBulletin('desgasificación alcanzando alturas de 600 metros sobre el cráter').parsed.explosionsPerHour,
      null,
    );
  });

  it('takes the reach when dispersal distance is a range', () => {
    assert.equal(
      parseBulletin('La ceniza se dispersa de 10 a 20 km en dirección oeste').parsed.driftKm,
      20,
    );
  });
});

describe('paroxysm phases', () => {
  // 5 August 2026, mid-eruption: no explosion count is published at all.
  const paroxysm =
    'El volcán de Fuego continúa con la fase eruptiva descrita en la última ' +
    'actualización. La actividad mantiene una emisión constante de material desde ' +
    'el cráter, generando columnas de ceniza densas que alcanzan alturas de 5000 a ' +
    '7000 msnm, con dispersión hacia el oeste y noroeste.';

  it('recognises a continuous eruptive phase', () => {
    assert.ok(parseBulletin(paroxysm).parsed.phenomena.includes('continuousPhase'));
  });

  it('does not warn about a rate that was never published', () => {
    const { parsed, warnings } = parseBulletin(paroxysm);
    assert.equal(parsed.explosionsPerHour, null);
    assert.ok(!warnings.includes('no-explosion-rate'));
  });

  it('still reads the column height during a paroxysm', () => {
    assert.deepEqual(parseBulletin(paroxysm).parsed.ashColumnMasl, { min: 5000, max: 7000 });
  });

  it('warns only when a printed rate could not be read', () => {
    // Nothing printed — silence, not failure.
    assert.ok(
      !parseBulletin('Se registraron explosiones débiles a moderadas durante la noche.')
        .warnings.includes('no-explosion-rate'),
    );
    // A rate is clearly printed but in a shape the parser cannot handle.
    assert.ok(
      parseBulletin('Se registran explosiones a un ritmo variable por hora.')
        .warnings.includes('no-explosion-rate'),
    );
  });
});

describe('rates separated from the noun by qualifiers', () => {
  it('reads a rate with the qualifier phrase in the middle', () => {
    // 29 July 2026 and several other days phrase it exactly this way.
    assert.deepEqual(
      parseBulletin(
        'Se registran de 6 a 8 explosiones de características débiles y moderadas por hora, las cuales elevan columnas',
      ).parsed.explosionsPerHour,
      { min: 6, max: 8 },
    );
  });

  it('reads "entre X y Y explosiones <adjectives> por hora"', () => {
    assert.deepEqual(
      parseBulletin(
        'La actividad explosiva se mantuvo entre 7 y 11 explosiones débiles y moderadas por hora, generando columnas',
      ).parsed.explosionsPerHour,
      { min: 7, max: 11 },
    );
  });

  it('never reads a wind speed in km/h as an explosion rate', () => {
    assert.equal(
      parseBulletin('Se registran explosiones; viento del este a 15 km por hora.')
        .parsed.explosionsPerHour,
      null,
    );
  });
});

describe('lava flows versus things that merely mention lava', () => {
  it('reads a flow with a stated length', () => {
    assert.equal(
      parseBulletin('Se mantiene un flujo de lava de 1,200 metros de longitud hacia la barranca').parsed.lavaFlowM,
      1200,
    );
  });

  it('does not record a forecast as an observed flow', () => {
    // 22 July 2026: "posibilidad de generar flujos de lava en los próximos días".
    assert.equal(
      parseBulletin(
        'existe la posibilidad de generar flujos de lava en los próximos días, con alturas de 300 metros',
      ).parsed.lavaFlowM,
      null,
    );
  });

  it('does not record fragments thrown above the crater as a flow', () => {
    // 3 Aug 2026: "expulsión de fragmentos de lava a 200 mts de altura".
    assert.equal(
      parseBulletin('expulsión de fragmentos de lava a 200 mts de altura sobre el cráter').parsed.lavaFlowM,
      null,
    );
  });
});

describe('named ashfall communities', () => {
  it('reads the places the observer named', () => {
    assert.deepEqual(
      parseBulletin(
        'caída de ceniza en Sangre de Cristo, San Pedro Yepocapa, Pochuta y otras comunidades.',
      ).parsed.ashfallCommunities,
      ['Sangre de Cristo', 'San Pedro Yepocapa', 'Pochuta'],
    );
  });

  it('returns nothing when the bulletin only says "communities to the west"', () => {
    assert.deepEqual(
      parseBulletin('Caída de ceniza fina en comunidades ubicadas en el flanco Oeste')
        .parsed.ashfallCommunities,
      [],
    );
  });

  it('ignores place names outside the ashfall clause', () => {
    assert.deepEqual(
      parseBulletin('Se recomienda no transitar por los cauces cercanos a Alotenango.')
        .parsed.ashfallCommunities,
      [],
    );
  });
});

describe('golden archive', () => {
  const root = path.resolve(import.meta.dirname, '..', '..');
  const archive = path.join(root, 'data', 'bulletins');
  const golden = path.join(import.meta.dirname, '__fixtures__', 'golden');
  const days = readdirSync(archive).filter((f) => f.endsWith('.json')).sort();
  const regen = 'run `node --import tsx scripts/golden.ts` and review the diff';

  const snaps = readdirSync(golden).filter((f) => f.endsWith('.json')).sort();

  /**
   * A day the collector just archived has no snapshot yet and must not turn the
   * base red (the collector runs this suite before it commits). A snapshot with
   * no bulletin is still a failure: something was deleted from the archive.
   */
  const compare = (archived: string[], snapshots: string[]) => ({
    orphans: snapshots.filter((f) => !archived.includes(f)),
    unsnapped: archived.filter((f) => !snapshots.includes(f)),
  });

  it('has no orphan snapshots', () => {
    const { orphans, unsnapped } = compare(days, snaps);
    if (unsnapped.length) {
      console.log(`[golden] ${unsnapped.length} archived day(s) have no snapshot yet; ${regen}`);
    }
    assert.deepEqual(orphans, [], `snapshots with no bulletin: ${regen}`);
  });

  it('lets a new day without a snapshot pass, but not an orphan', () => {
    assert.deepEqual(compare(['a.json', 'b.json'], ['a.json']), { orphans: [], unsnapped: ['b.json'] });
    assert.deepEqual(compare(['a.json'], ['a.json', 'gone.json']).orphans, ['gone.json']);
  });

  for (const file of days) {
    if (!snaps.includes(file)) continue;
    it(`${file.slice(0, -5)} parses to its snapshot`, () => {
      const bulletin = JSON.parse(readFileSync(path.join(archive, file), 'utf8'));
      const expected = JSON.parse(readFileSync(path.join(golden, file), 'utf8'));
      const { parsed, warnings, parserVersion } = parseBulletin(bulletin.raw);
      assert.equal(parserVersion, PARSER_VERSION);
      assert.equal(expected.parserVersion, PARSER_VERSION, `stale snapshot: ${regen}`);
      assert.deepEqual({ warnings, parsed }, { warnings: expected.warnings, parsed: expected.parsed },
        `parser output changed for ${bulletin.date}: if on purpose, bump PARSER_VERSION, then ${regen}`);
    });
  }

  // Days a person checked against the raw text; the snapshot alone could
  // agree with a wrong parse, so these pin the values to what is printed.
  const read = (date: string) =>
    parseBulletin(JSON.parse(readFileSync(path.join(archive, `${date}.json`), 'utf8')).raw).parsed;

  it('2026-06-09: "a un ritmo de 4 a 7 por hora" is 4 to 7', () => {
    assert.deepEqual(read('2026-06-09').explosionsPerHour, { min: 4, max: 7 });
  });
  it('2026-08-25: a comma before "por hora" does not hide the rate', () => {
    assert.deepEqual(read('2026-08-25').explosionsPerHour, { min: 6, max: 10 });
  });
  it('2026-11-02: "un promedio de 3 explosiones ... por hora" is 3', () => {
    assert.deepEqual(read('2026-11-02').explosionsPerHour, { min: 3, max: 3 });
  });
  it('2026-10-05: the column is read even when "ceniza" appears earlier', () => {
    assert.deepEqual(read('2026-10-05').ashColumnMasl, { min: 4200, max: 4700 });
  });
  it('2026-06-10: "transportadas en dirección suroeste" is SW', () => {
    assert.deepEqual(read('2026-06-10').driftDirections, ['SW']);
  });
  it('2026-11-03: avalanche flanks are not plume directions', () => {
    assert.deepEqual(read('2026-11-03').driftDirections.sort(), ['S', 'SW']);
  });
  it('2026-11-10: a conditional "puede cambiar hacia el oeste" is not a reading', () => {
    assert.deepEqual(read('2026-11-10').driftDirections, ['SW']);
  });
  it('2026-08-30: "norooeste" (printed so) is read as north-west', () => {
    assert.deepEqual(read('2026-08-30').driftDirections.sort(), ['NW', 'W']);
  });
  it('2026-06-20: "caída débil de ceniza fina sobre ..." names its communities', () => {
    assert.deepEqual(read('2026-06-20').ashfallCommunities, ['Sangre de Cristo']);
  });
});

describe('OCR noise', () => {
  it('reads letter O for zero inside a figure: 4,5OO', () => {
    assert.equal(cleanOcrText('alturas de 4,5OO msnm'), 'alturas de 4,500 msnm');
    assert.deepEqual(parseBulletin('Actividad ' + 'x'.repeat(40) + ' columnas de ceniza de 4,2OO a 4,7OO msnm').parsed.ashColumnMasl,
      { min: 4200, max: 4700 });
  });

  it('does not turn words or ordinals into numbers', () => {
    assert.equal(cleanOcrText('el 1o de junio, Oeste, 3 o 4 veces'), 'el 1o de junio, Oeste, 3 o 4 veces');
  });

  it('survives line breaks inside a phrase', () => {
    const { parsed } = parseBulletin('Actividad\nSe registran explosiones débiles, moderadas y fuertes, a un\nritmo de 4\na 7 por\nhora, con columna a 4800\nmsnm.');
    assert.deepEqual(parsed.explosionsPerHour, { min: 4, max: 7 });
    assert.deepEqual(parsed.ashColumnMasl, { min: 4800, max: 4800 });
  });

  it('survives stray characters from the page furniture', () => {
    const { parsed } = parseBulletin('Actividad » | Se registran entre 6 y 9 explosiones por hora | ¿$, ceniza a 4,500 m s n m | se dispersa hacia el Oeste.');
    assert.deepEqual(parsed.explosionsPerHour, { min: 6, max: 9 });
    assert.deepEqual(parsed.ashColumnMasl, { min: 4500, max: 4500 });
    assert.deepEqual(parsed.driftDirections, ['W']);
  });

  it('reads accented "Dispersándose" as a dispersal clause', () => {
    assert.deepEqual(parseBulletin('Dispersándose al oeste y suroeste.').parsed.driftDirections.sort(), ['SW', 'W']);
  });
});
