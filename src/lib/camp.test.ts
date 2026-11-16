import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { IndexEntry } from '../../scripts/build-index';
import {
  CAMP_BEARING_DEG,
  CAMP_DISTANCE_KM,
  bearingDeg,
  describeCamp,
  distanceKm,
  driftRelation,
  latestEntry,
} from './camp';
import { SUMMITS } from './terrain';

function entry(over: Partial<IndexEntry> = {}): IndexEntry {
  return {
    date: '2026-11-16',
    explosionsMin: 3,
    explosionsMax: 6,
    ashMinMasl: 5000,
    ashMaxMasl: 5000,
    driftKm: 20,
    driftDirections: ['E', 'NE'],
    drainages: [],
    lavaFlowM: null,
    phenomena: ['explosions', 'ashfall'],
    ashfallCommunities: [],
    warnings: [],
    ...over,
  };
}

const line = (e: IndexEntry, key: string) => {
  const found = describeCamp(e).lines.find((l) => l.key === key);
  assert.ok(found, `no ${key} line`);
  return found;
};

describe('bearing from Fuego to camp', () => {
  test('is computed from the terrain summits: just east of north, about 3 km', () => {
    const b = bearingDeg(SUMMITS.fuego, SUMMITS.acatenango);
    assert.equal(b, CAMP_BEARING_DEG);
    assert.ok(b > 5 && b < 15, `bearing ${b}`);
    const d = distanceKm(SUMMITS.fuego, SUMMITS.acatenango);
    assert.equal(d, CAMP_DISTANCE_KM);
    assert.ok(d > 2.8 && d < 3.2, `distance ${d}`);
  });

  test('cardinal bearings come out where they should', () => {
    const o = { lat: 14.5, lon: -90.9 };
    assert.ok(Math.abs(bearingDeg(o, { lat: 14.6, lon: -90.9 }) - 0) < 0.01);
    assert.ok(Math.abs(bearingDeg(o, { lat: 14.5, lon: -90.8 }) - 90) < 0.1);
    assert.ok(Math.abs(bearingDeg(o, { lat: 14.4, lon: -90.9 }) - 180) < 0.01);
    assert.ok(Math.abs(bearingDeg(o, { lat: 14.5, lon: -91.0 }) - 270) < 0.1);
  });
});

describe('drift relative to camp, every compass point', () => {
  // Camp is about 10° from Fuego. Within a quarter of the compass (45°) of that
  // is towards, within 45° of the opposite is away, and the rest is to one side.
  const expected = {
    N: 'towards', NE: 'towards', E: 'side', SE: 'side',
    S: 'away', SW: 'away', W: 'side', NW: 'side',
  } as const;
  for (const [dir, rel] of Object.entries(expected)) {
    test(`${dir} is ${rel}`, () => {
      assert.equal(driftRelation(dir), rel);
    });
  }

  test('the relation follows the bearing, not a fixed table', () => {
    // A camp due east: east is towards, west away, north and south to one side.
    assert.equal(driftRelation('E', 90), 'towards');
    assert.equal(driftRelation('W', 90), 'away');
    assert.equal(driftRelation('N', 90), 'side');
    assert.equal(driftRelation('S', 90), 'side');
  });

  test('exactly a quarter-compass point off counts as towards', () => {
    assert.equal(driftRelation('NE', 0), 'towards');
    assert.equal(driftRelation('SE', 0), 'away');
  });

  test('an unknown direction gives no relation', () => {
    assert.equal(driftRelation('Q'), null);
  });
});

describe('the description', () => {
  test('a full day reads in plain words, built from the fields', () => {
    const c = describeCamp(entry({ ashMinMasl: 4500, driftDirections: ['S', 'SW'] }));
    assert.equal(
      c.summary,
      '3 to 6 explosions an hour, ash to 5,000 m drifting south and south-west, away from Acatenango.',
    );
    assert.equal(line(entry(), 'rate').text, '3 to 6 explosions an hour.');
    assert.equal(
      line(entry({ ashMinMasl: 4500 }), 'column').text,
      'Ash columns of 4,500 to 5,000 m above sea level, up to 1,237 m above Fuego’s summit.',
    );
    assert.equal(
      line(entry(), 'column').text,
      'Ash to 5,000 m above sea level, 1,237 m above Fuego’s summit.',
    );
  });

  test('mixed directions are grouped by how they sit from camp, in the bulletin’s order', () => {
    assert.equal(
      line(entry({ driftDirections: ['NE', 'E', 'N'] }), 'drift').text,
      'Ash drifting 20 km north-east and north, towards Acatenango, and east, to one side of it.',
    );
  });

  test('a single figure reads once, and one explosion is singular', () => {
    assert.equal(line(entry({ explosionsMin: 6, explosionsMax: 6 }), 'rate').text, '6 explosions an hour.');
    assert.equal(line(entry({ explosionsMin: null, explosionsMax: 1 }), 'rate').text, '1 explosion an hour.');
  });

  test('missing fields are said to be missing, never zero', () => {
    const c = describeCamp(entry({
      explosionsMin: null, explosionsMax: null, ashMinMasl: null, ashMaxMasl: null,
      driftKm: null, driftDirections: [], phenomena: [], ashfallCommunities: [],
    }));
    for (const l of c.lines) {
      assert.equal(l.missing, true, `${l.key} should be missing`);
      assert.doesNotMatch(l.text, /\b0\b/, `${l.key} must not read as zero`);
    }
    assert.equal(line(c.entry, 'rate').text, 'The bulletin gave no explosion rate.');
    assert.equal(line(c.entry, 'column').text, 'The bulletin gave no ash column height.');
    assert.equal(line(c.entry, 'drift').text, 'The bulletin gave no drift distance or direction.');
    assert.equal(line(c.entry, 'ashfall').text, 'The bulletin did not mention ash fall.');
    assert.equal(c.summary, 'The bulletin gave no explosion rate, ash column or drift.');
  });

  test('a continuous phase is not a missing rate', () => {
    const l = line(entry({ explosionsMin: null, explosionsMax: null, phenomena: ['continuousPhase'] }), 'rate');
    assert.equal(l.missing, false);
    assert.equal(l.text, 'Continuous emission, so the bulletin gives no hourly count.');
  });

  test('drift with a direction but no distance says which part is missing', () => {
    const l = line(entry({ driftKm: null, driftDirections: ['N'] }), 'drift');
    assert.equal(l.text, 'Ash drifting north, towards Acatenango. The bulletin gave no drift distance.');
    assert.equal(l.missing, true);
  });

  test('drift with a distance but no direction cannot be placed relative to camp', () => {
    const l = line(entry({ driftDirections: [] }), 'drift');
    assert.equal(l.text, 'Ash drifting 20 km. The bulletin gave no direction, so where it went relative to Acatenango is unknown.');
    assert.equal(l.missing, true);
    assert.equal(describeCamp(entry({ driftDirections: [] })).summary, '3 to 6 explosions an hour, ash to 5,000 m.');
  });

  test('summary leaves out what is missing rather than inventing it', () => {
    assert.equal(
      describeCamp(entry({ ashMinMasl: null, ashMaxMasl: null })).summary,
      '3 to 6 explosions an hour, ash drifting east, to one side of Acatenango, and north-east, towards it.',
    );
    assert.equal(
      describeCamp(entry({ explosionsMin: null, explosionsMax: null, phenomena: [] })).summary,
      'Ash to 5,000 m drifting east, to one side of Acatenango, and north-east, towards it.',
    );
  });

  test('ash-fall towns are listed when reported', () => {
    const l = line(entry({ ashfallCommunities: ['Panimache I', 'Morelia', 'Sangre de Cristo'] }), 'ashfall');
    assert.equal(l.text, 'Ash fall reported in Panimache I, Morelia and Sangre de Cristo.');
    assert.deepEqual(l.places, ['Panimache I', 'Morelia', 'Sangre de Cristo']);
    assert.equal(line(entry({ ashfallCommunities: ['Alotenango'] }), 'ashfall').text, 'Ash fall reported in Alotenango.');
  });

  test('ash fall with no towns named says so', () => {
    const l = line(entry({ ashfallCommunities: [], phenomena: ['ashfall'] }), 'ashfall');
    assert.equal(l.text, 'Ash fall reported; the bulletin named no towns.');
    assert.equal(l.missing, true);
  });

  test('nothing is worded as safety advice', () => {
    const days = [
      entry(),
      entry({ driftDirections: ['N'] }),
      entry({ driftDirections: ['S'], ashfallCommunities: ['Alotenango'] }),
      entry({ explosionsMax: null, ashMaxMasl: null, driftKm: null, driftDirections: [] }),
    ];
    for (const d of days) {
      const c = describeCamp(d);
      for (const t of [c.summary, ...c.lines.map((l) => l.text)]) {
        assert.doesNotMatch(t, /\b(safe|safely|unsafe|danger|dangerous|risk|should|avoid|evacuat|warning)\b/i, t);
      }
    }
  });
});

describe('the day', () => {
  test('is the latest entry, the one the mountain opens on', () => {
    const series = [entry({ date: '2026-11-14' }), entry({ date: '2026-11-15' }), entry({ date: '2026-11-16' })];
    assert.equal(latestEntry(series)?.date, '2026-11-16');
    assert.equal(latestEntry([]), null);
  });
});
