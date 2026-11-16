import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { IndexEntry } from '../../scripts/build-index';
import { describeAge } from '../lib/bulletin-age';
import { describeCamp } from '../lib/camp';
import { readoutRows } from '../lib/readout';
import { completeness } from '../lib/series';
import { en } from './en';
import { es } from './es';
import { formatDate, formatNumber, formatShortDate } from './format';
import { DICTS, LOCALE_PATH, LOCALES } from './index';
import type { Dict } from './types';

function entry(over: Partial<IndexEntry> = {}): IndexEntry {
  return {
    date: '2026-11-16',
    explosionsMin: 3,
    explosionsMax: 6,
    ashMinMasl: 4500,
    ashMaxMasl: 5000,
    driftKm: 20,
    driftDirections: ['NE', 'E'],
    incandescenceMinM: null,
    incandescenceMaxM: null,
    drainages: [],
    lavaFlowM: null,
    phenomena: ['explosions', 'ashfall'],
    ashfallCommunities: [],
    warnings: [],
    ...over,
  };
}

const EMPTY = entry({
  explosionsMin: null, explosionsMax: null, ashMinMasl: null, ashMaxMasl: null,
  driftKm: null, driftDirections: [], phenomena: [],
});

/** The shape of a dictionary: every key path, with functions and strings told apart. */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'function') return [`${path}()`];
  if (typeof value === 'string') return [path];
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().flatMap((k) => shape((value as Record<string, unknown>)[k], `${path}.${k}`));
  }
  return [`${path}:${typeof value}`];
}

/** Every plain string in a dictionary. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const camp = (t: Dict, e: IndexEntry, key: string) => {
  const found = describeCamp(e, t).lines.find((l) => l.key === key);
  assert.ok(found, `no ${key} line`);
  return found;
};

describe('dictionaries', () => {
  test('English and Spanish have exactly the same keys', () => {
    assert.deepEqual(shape(es), shape(en));
  });

  test('no string is empty, and Spanish is not English left in place', () => {
    for (const t of [en, es]) {
      for (const s of strings(t)) assert.ok(s.trim().length > 0, `empty string in ${t.locale}`);
    }
    // Names, codes and units are the same in both; prose must differ.
    const same = new Set(['en', 'es', 'N', 'NE', 'E', 'SE', 'S', 'm', 'Explosiones', 'Explosions']);
    const enStrings = new Set(strings(en).filter((s) => s.length > 3 && !same.has(s)));
    for (const s of strings(es)) assert.ok(!enStrings.has(s), `untranslated: ${s}`);
  });

  test('each language has a path, and Spanish lives under /es/', () => {
    assert.deepEqual(LOCALES, ['en', 'es']);
    assert.equal(LOCALE_PATH.en, '/');
    assert.equal(LOCALE_PATH.es, '/es/');
    assert.equal(DICTS.es.htmlLang, 'es');
  });
});

describe('the notice keeps its meaning in Spanish', () => {
  test('unofficial, not a warning service, copies INSIVUMEH, always behind', () => {
    assert.equal(es.notice.lead, 'Archivo no oficial.');
    assert.match(es.notice.body, /^Este sitio, Fuego, no es un servicio de alertas\./);
    assert.match(es.notice.body, /Copia el boletín diario del INSIVUMEH una o dos veces al día/);
    assert.match(es.notice.body, /siempre va con retraso respecto al observatorio/);
    assert.match(es.notice.insivumeh, /INSIVUMEH/);
    assert.match(es.notice.conred, /CONRED/);
  });

  test('neither language words anything as safety advice', () => {
    const advice = /\b(safe|safety|dangerous|danger|unsafe|seguro|segura|peligro|peligroso|peligrosa|recomendamos|debe subir)\b/i;
    for (const t of [en, es]) {
      for (const s of strings(t)) assert.doesNotMatch(s, advice, `${t.locale}: ${s}`);
      const c = describeCamp(entry({ ashfallCommunities: ['Panimaché I'] }), t);
      for (const s of [c.summary, ...c.lines.map((l) => l.text)]) assert.doesNotMatch(s, advice);
    }
    assert.match(es.camp.advice, /No es un consejo sobre si subir o acampar/);
  });
});

describe('dates and numbers per language', () => {
  test('Spanish dates are es-GT, English en-GB', () => {
    assert.equal(formatDate('en', '2026-11-16'), '16 Nov 2026');
    assert.match(formatDate('es', '2026-11-16'), /^16 nov\.? 2026$/);
    assert.match(formatShortDate('es', '2026-01-05'), /^5 ene\.?$/);
  });

  test('Guatemala groups thousands with a comma and uses a decimal point', () => {
    assert.equal(formatNumber('es', 4500), '4,500');
    assert.equal(formatNumber('es', 1.5), '1.5');
    assert.equal(formatNumber('en', 4500), '4,500');
    assert.equal(formatNumber('es', 3, 1), '3.0');
  });

  test('bulletin age', () => {
    assert.equal(describeAge(0, es).label, 'hoy');
    assert.equal(describeAge(1, es).label, 'hace 1 día');
    assert.equal(describeAge(4, es).label, 'hace 4 días');
    assert.equal(describeAge(4).label, '4 days ago');
  });
});

describe('camp panel sentences, both languages', () => {
  test('a full bulletin', () => {
    const e = entry({ driftDirections: ['NE', 'E'], ashfallCommunities: ['Morelia', 'Panimaché I'] });
    assert.equal(
      describeCamp(e, en).summary,
      '3 to 6 explosions an hour, ash to 5,000 m drifting north-east, towards Acatenango, and east, to one side of it.',
    );
    assert.equal(
      describeCamp(e, es).summary,
      '3 a 6 explosiones por hora, ceniza hasta 5,000 m, desplazándose hacia el noreste, en dirección al Acatenango, y hacia el este, hacia un costado de él.',
    );
    assert.equal(camp(es, e, 'column').text, 'Columnas de ceniza de 4,500 a 5,000 m s.n.m., hasta 1,237 m sobre la cumbre del Fuego.');
    assert.equal(camp(es, e, 'drift').text, 'La ceniza se desplaza 20 km hacia el noreste, en dirección al Acatenango, y hacia el este, hacia un costado de él.');
    assert.equal(camp(es, e, 'ashfall').text, 'Caída de ceniza reportada en Morelia y Panimaché I.');
    assert.equal(camp(es, e, 'rate').label, 'Explosiones');
  });

  test('directions in the same relation share one "hacia"', () => {
    const e = entry({ driftDirections: ['N', 'NE', 'SW'] });
    assert.equal(
      camp(es, e, 'drift').text,
      'La ceniza se desplaza 20 km hacia el norte y el noreste, en dirección al Acatenango, y hacia el suroeste, alejándose de él.',
    );
  });

  test('one explosion an hour is singular', () => {
    const e = entry({ explosionsMin: 1, explosionsMax: 1 });
    assert.equal(camp(es, e, 'rate').text, '1 explosión por hora.');
    assert.equal(camp(en, e, 'rate').text, '1 explosion an hour.');
  });

  test('"y" becomes "e" before an i sound', () => {
    assert.equal(es.list(['Morelia', 'Isla']), 'Morelia e Isla');
    assert.equal(es.list(['Morelia', 'Hierba']), 'Morelia y Hierba');
    assert.equal(es.list(['A', 'B', 'Higuerillas']), 'A, B e Higuerillas');
  });

  test('continuous emission is not a missing rate', () => {
    const e = entry({ explosionsMin: null, explosionsMax: null, phenomena: ['continuousPhase'] });
    const line = camp(es, e, 'rate');
    assert.equal(line.missing, false);
    assert.equal(line.text, 'Emisión continua, por lo que el boletín no da un conteo por hora.');
    assert.match(describeCamp(e, es).summary, /^Emisión continua, /);
  });

  test('missing fields are said to be missing, never 0, in Spanish too', () => {
    const c = describeCamp(EMPTY, es);
    assert.equal(c.summary, 'El boletín no dio tasa de explosiones, columna de ceniza ni desplazamiento.');
    assert.deepEqual(c.lines.map((l) => l.missing), [true, true, true, true]);
    assert.deepEqual(c.lines.map((l) => l.text), [
      'El boletín no dio tasa de explosiones.',
      'El boletín no dio la altura de la columna de ceniza.',
      'El boletín no dio distancia ni dirección del desplazamiento.',
      'El boletín no mencionó caída de ceniza.',
    ]);
    for (const l of c.lines) assert.doesNotMatch(l.text, /\b0\b/);
  });

  test('drift with no direction, and direction with no distance', () => {
    assert.equal(
      camp(es, entry({ driftDirections: [] }), 'drift').text,
      'La ceniza se desplaza 20 km. El boletín no dio la dirección, así que no se sabe hacia dónde fue respecto al Acatenango.',
    );
    assert.equal(
      camp(es, entry({ driftKm: null, driftDirections: ['W'] }), 'drift').text,
      'La ceniza se desplaza hacia el oeste, hacia un costado del Acatenango. El boletín no dio la distancia del desplazamiento.',
    );
  });
});

describe('completeness lines, both languages', () => {
  const series = [
    entry(),
    entry({ explosionsMax: null, explosionsMin: null, phenomena: ['continuousPhase'], driftKm: null }),
    entry({ ashMaxMasl: null, ashMinMasl: null, explosionsMax: null, explosionsMin: null }),
  ];
  const lines = (t: Dict) =>
    completeness(series).map((c) => t.colophon.completeness(t.colophon.field[c.field], c.reported, c.total, c.continuous ?? 0));

  test('English', () => {
    assert.deepEqual(lines(en), [
      'The explosion rate was reported on 1 of 3 days, and 1 more were continuous emission, which has no hourly count.',
      'The ash column height was reported on 2 of 3 days.',
      'The drift distance was reported on 2 of 3 days.',
    ]);
  });

  test('Spanish', () => {
    assert.deepEqual(lines(es), [
      'La tasa de explosiones se reportó en 1 de 3 días, y 1 más fueron emisión continua, que no tiene conteo por hora.',
      'La altura de la columna de ceniza se reportó en 2 de 3 días.',
      'La distancia del desplazamiento se reportó en 2 de 3 días.',
    ]);
  });
});

describe('readout, both languages', () => {
  test('the most common drift is spelled out in Spanish, where a lone O would read as zero', () => {
    assert.equal(es.lanes.commonDriftValue(['W'], 107), 'Oeste (107 días)');
    assert.equal(es.lanes.commonDriftValue(['W', 'SW'], 1), 'Oeste y suroeste (1 día)');
    assert.equal(en.lanes.commonDriftValue(['W'], 107), 'W (107 days)');
  });

  test('Spanish rows use INSIVUMEH terms and Spanish compass letters', () => {
    const rows = readoutRows(entry({ driftDirections: ['SW', 'W'], drainages: ['Las Lajas'] }), es);
    assert.deepEqual(rows.map((r) => r.key), ['Explosiones', 'Columna de ceniza', 'Sobre la cumbre', 'Desplazamiento', 'Barrancas']);
    assert.equal(rows[1].unit, 'm s.n.m.');
    assert.equal(rows[3].unit, 'km SO·O');
  });

  test('a missing value is "Sin reporte", never 0', () => {
    for (const r of readoutRows(EMPTY, es)) {
      assert.equal(r.missing, true, r.key);
      assert.notEqual(r.value, '0');
    }
    assert.equal(readoutRows(EMPTY, es)[0].value, 'Sin reporte');
  });

  test('English is still the default', () => {
    assert.equal(readoutRows(entry())[0].key, 'Explosions');
  });
});
