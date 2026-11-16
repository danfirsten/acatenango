import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { IndexEntry } from '../../scripts/build-index';
import { bearing, dayAt, dayX, fieldSummary, incandescenceTop } from './fields';

function day(date: string, over: Partial<IndexEntry> = {}): IndexEntry {
  return {
    date, explosionsMin: null, explosionsMax: null, ashMinMasl: null, ashMaxMasl: null,
    driftKm: null, driftDirections: [], incandescenceMinM: null, incandescenceMaxM: null,
    drainages: [], lavaFlowM: null, phenomena: [], ashfallCommunities: [], warnings: [], ...over,
  };
}

const SERIES = [
  day('2026-11-01', { driftDirections: ['W'], drainages: ['Seca', 'Ceniza'], incandescenceMaxM: 300 }),
  day('2026-11-02', { driftDirections: ['W', 'SW'], drainages: ['Seca'], ashfallCommunities: ['Morelia'] }),
  day('2026-11-03'),
  day('2026-11-04', { driftDirections: ['SW'], drainages: ['Seca'], incandescenceMaxM: 150 }),
];

describe('fieldSummary', () => {
  const s = fieldSummary(SERIES);
  it('finds the most common drift over reported days only', () => {
    assert.deepEqual(s.commonDrift, ['SW', 'W']);
    assert.equal(s.commonDriftDays, 2);
    assert.equal(s.driftReported, 3);
    assert.equal(s.total, 4);
  });
  it('counts drainages by days named, over days that named any', () => {
    assert.deepEqual(s.drainages, [{ name: 'Seca', days: 3 }, { name: 'Ceniza', days: 1 }]);
    assert.equal(s.drainagesReported, 3);
  });
  it('counts towns and incandescence days without treating a gap as zero', () => {
    assert.deepEqual(s.towns, [{ name: 'Morelia', days: 1 }]);
    assert.equal(s.townsReported, 1);
    assert.equal(s.incandescenceReported, 2);
  });
  it('says nothing is common when nothing was reported', () => {
    const none = fieldSummary([day('2026-11-01'), day('2026-11-02')]);
    assert.deepEqual(none.commonDrift, []);
    assert.equal(none.driftReported, 0);
    assert.equal(incandescenceTop([day('2026-11-01')]), null);
  });
  it('takes the tallest incandescence over reported days', () => {
    assert.equal(incandescenceTop(SERIES), 300);
  });
});

describe('shared axis', () => {
  it('puts days where the tempo chart does and reads them back', () => {
    assert.equal(dayX(0, 5), 0);
    assert.equal(dayX(4, 5), 1000);
    assert.equal(dayX(2, 5), 500);
    assert.equal(dayX(0, 1), 500);
    assert.equal(dayAt(510, 5), 2);
    assert.equal(dayAt(5000, 5), 4);
    assert.equal(dayAt(-9, 5), 0);
  });
  it('knows compass bearings', () => {
    assert.equal(bearing('N'), 0);
    assert.equal(bearing('SW'), 225);
    assert.equal(bearing('up'), null);
  });
});
