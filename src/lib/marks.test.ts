import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { IndexEntry } from '../../scripts/build-index';
import { MARK_CLASS } from '../components/ink/Mark';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import {
  type DayField, fieldState, PLOT_GUTTER, plotDayAt, plotX, readoutRows, STATE_MARK, VALUE_STATES,
} from './readout';

function day(over: Partial<IndexEntry> = {}): IndexEntry {
  return {
    date: '2026-07-29',
    explosionsMin: 6,
    explosionsMax: 8,
    ashMinMasl: 4500,
    ashMaxMasl: 4800,
    driftKm: 40,
    driftDirections: ['W', 'NW'],
    incandescenceMinM: 100,
    incandescenceMaxM: 200,
    drainages: ['Las Lajas'],
    lavaFlowM: null,
    phenomena: [],
    ashfallCommunities: [],
    warnings: [],
    ...over,
  };
}

const EMPTY = day({
  explosionsMin: null, explosionsMax: null, ashMinMasl: null, ashMaxMasl: null, driftKm: null,
  driftDirections: [], incandescenceMinM: null, incandescenceMaxM: null, drainages: [],
});
const FIELDS: DayField[] = ['rate', 'column', 'drift', 'glow', 'drainages', 'towns'];

describe('the five marks', () => {
  it('gives each state its own mark from the system, in the system order', () => {
    assert.deepEqual(VALUE_STATES, ['reported', 'saidNone', 'notReported', 'held', 'continuous']);
    assert.deepEqual(STATE_MARK, {
      reported: 'solid', saidNone: 'ring', notReported: 'hatched', held: 'dotted', continuous: 'half',
    });
    const marks = new Set(Object.values(STATE_MARK));
    assert.equal(marks.size, 5, 'no two states share a mark');
    for (const m of marks) assert.ok(MARK_CLASS[m]);
  });

  it('has a word and a hint for every state in both languages', () => {
    for (const t of [en, es]) {
      for (const s of VALUE_STATES) {
        assert.ok(t.marks.word[s].length > 0 && t.marks.hint[s].length > 0, `${t.locale} ${s}`);
      }
    }
    assert.deepEqual(VALUE_STATES.map((s) => en.marks.word[s]),
      ['Reported', 'Said none', 'Not reported', 'Held', 'Continuous']);
  });
});

describe('fieldState', () => {
  it('reads a full bulletin as reported', () => {
    const full = day({ ashfallCommunities: ['Morelia'] });
    for (const f of FIELDS) assert.equal(fieldState(full, f), 'reported', f);
  });

  it('reads a left-out field as not reported, never as a value', () => {
    for (const f of FIELDS) assert.equal(fieldState(EMPTY, f), 'notReported', f);
  });

  it('keeps continuous emission apart from a missing rate', () => {
    assert.equal(fieldState(day({ explosionsMax: null, phenomena: ['continuousPhase'] }), 'rate'), 'continuous');
    assert.equal(fieldState(day({ explosionsMax: null }), 'rate'), 'notReported');
  });

  it('tells "none named" from "not reported" for ash fall (P9)', () => {
    assert.equal(fieldState(day({ phenomena: ['ashfall'] }), 'towns'), 'saidNone');
    assert.equal(fieldState(day(), 'towns'), 'notReported');
  });

  it('counts a drift with only a direction, or only a distance, as reported', () => {
    assert.equal(fieldState(day({ driftKm: null }), 'drift'), 'reported');
    assert.equal(fieldState(day({ driftDirections: [] }), 'drift'), 'reported');
  });
});

describe('readoutRows marks', () => {
  it('marks every row, solid where reported', () => {
    const rows = readoutRows(day({ ashfallCommunities: ['Morelia'] }));
    assert.deepEqual(rows.map((r) => r.state), ['reported', 'reported', 'reported', 'reported', 'reported']);
  });

  it('marks a held rate and column with the dotted ring and names the day the plume shows', () => {
    const rows = readoutRows(EMPTY, en, { rate: '26 Jul', column: '25 Jul' });
    assert.deepEqual(rows.slice(0, 3).map((r) => [r.state, r.value, r.unit]), [
      ['held', 'Held', 'plume shows 26 Jul'],
      ['held', 'Held', 'plume shows 25 Jul'],
      ['held', 'Held', 'plume shows 25 Jul'],
    ]);
    assert.equal(readoutRows(EMPTY, es, { rate: '26 jul' })[0].unit, 'la columna muestra el 26 jul');
  });

  it('marks a left-out value as not reported when nothing is held', () => {
    for (const r of readoutRows(EMPTY)) {
      assert.equal(r.state, 'notReported', r.key);
      assert.equal(r.missing, true, r.key);
    }
  });

  it('says "None named" with the ring when ash fell on no named town', () => {
    const last = readoutRows(day({ drainages: [], phenomena: ['ashfall'] })).at(-1)!;
    assert.deepEqual([last.key, last.value, last.state, last.missing], ['Ash fall', 'None named', 'saidNone', undefined]);
    assert.notEqual(last.value, en.readout.notReported);
  });
});

describe('plot axis', () => {
  it('starts past the gutter and ends at the edge', () => {
    assert.equal(plotX(0, 10, 400), PLOT_GUTTER);
    assert.equal(plotX(9, 10, 400), 400);
    assert.equal(plotX(0, 1, 400), PLOT_GUTTER + (400 - PLOT_GUTTER) / 2);
  });

  it('maps an x back to the nearest day, clamped to the record', () => {
    for (let i = 0; i < 10; i++) assert.equal(plotDayAt(plotX(i, 10, 400), 10, 400), i);
    assert.equal(plotDayAt(0, 10, 400), 0);
    assert.equal(plotDayAt(999, 10, 400), 9);
    assert.equal(plotDayAt(50, 1, 400), 0);
  });
});
