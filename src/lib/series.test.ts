import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { IndexEntry } from '../../scripts/build-index';
import {
  lastReportedIndex,
  paroxysmIndex,
  rateRuns,
  readoutRows,
  runDays,
  summaryFigures,
} from './readout';
import { completeness } from './series';

function day(date: string, over: Partial<IndexEntry> = {}): IndexEntry {
  return {
    date,
    explosionsMin: 6,
    explosionsMax: 10,
    ashMinMasl: 4300,
    ashMaxMasl: 4600,
    driftKm: 12,
    driftDirections: ['W'],
    drainages: ['Las Lajas'],
    lavaFlowM: null,
    phenomena: [],
    ashfallCommunities: [],
    warnings: [],
    ...over,
  };
}

const gap = { explosionsMin: null, explosionsMax: null };

// Reported, reported, missing, missing, reported, missing.
const SERIES: IndexEntry[] = [
  day('2026-11-01', { explosionsMax: 8 }),
  day('2026-11-02', { explosionsMax: 12, ashMaxMasl: 4900 }),
  day('2026-11-03', { ...gap, ashMaxMasl: null, driftKm: null }),
  day('2026-11-04', { ...gap, phenomena: ['continuousPhase'], ashMaxMasl: 5800 }),
  day('2026-11-05', { explosionsMax: 9 }),
  day('2026-11-06', { ...gap, driftKm: null, driftDirections: [] }),
];

describe('rateRuns', () => {
  it('splits the rate into reported runs and the gaps between them', () => {
    assert.deepEqual(rateRuns(SERIES), {
      reported: [{ start: 0, end: 1 }, { start: 4, end: 4 }],
      missing: [{ start: 2, end: 2 }, { start: 5, end: 5 }],
      continuous: [{ start: 3, end: 3 }],
    });
  });

  it('covers every day exactly once', () => {
    const { reported, missing, continuous } = rateRuns(SERIES);
    assert.equal(runDays(reported) + runDays(missing) + runDays(continuous), SERIES.length);
  });

  it('agrees with the footer: not reported excludes continuous days', () => {
    const { missing, continuous } = rateRuns(SERIES);
    const [rate] = completeness(SERIES);
    assert.equal(runDays(missing), rate.total - rate.reported - (rate.continuous ?? 0));
    assert.equal(runDays(continuous), rate.continuous);
  });

  it('handles a record with no reported days', () => {
    const none = [day('2026-11-01', gap), day('2026-11-02', gap)];
    assert.deepEqual(rateRuns(none), { reported: [], missing: [{ start: 0, end: 1 }], continuous: [] });
  });
});

describe('completeness', () => {
  it('counts reported days per field from the entries', () => {
    assert.deepEqual(completeness(SERIES), [
      { field: 'explosion rate', reported: 3, total: 6, continuous: 1 },
      { field: 'ash column height', reported: 5, total: 6 },
      { field: 'drift distance', reported: 4, total: 6 },
    ]);
  });

  it('counts a reported 0 as reported, and a null as missing', () => {
    const zero = [day('2026-11-01', { explosionsMin: 0, explosionsMax: 0 }), day('2026-11-02', gap)];
    assert.equal(completeness(zero)[0].reported, 1);
  });
});

describe('summaryFigures', () => {
  it('ignores missing days and says how many days it used', () => {
    assert.deepEqual(summaryFigures(SERIES), {
      tallestColumn: { value: 5800, days: 5 },
      peakRate: { value: 12, days: 3 },
    });
  });

  it('is null, not 0, when no day reported the field', () => {
    const none = [day('2026-11-01', { ...gap, ashMaxMasl: null })];
    assert.deepEqual(summaryFigures(none), {
      tallestColumn: { value: null, days: 0 },
      peakRate: { value: null, days: 0 },
    });
  });
});

describe('paroxysmIndex', () => {
  it('picks the tallest reported column and skips missing ones', () => {
    assert.equal(paroxysmIndex(SERIES), 3);
  });

  it('is -1 when no day reported a column', () => {
    assert.equal(paroxysmIndex([day('2026-11-01', { ashMaxMasl: null })]), -1);
  });
});

describe('lastReportedIndex', () => {
  it('returns the day itself when it reported a rate', () => {
    assert.equal(lastReportedIndex(SERIES, 4), 4);
  });

  it('falls back to the latest earlier day with a rate', () => {
    assert.equal(lastReportedIndex(SERIES, 3), 1);
    assert.equal(lastReportedIndex(SERIES, 5), 4);
  });

  it('holds any field it is given, such as the ash column', () => {
    assert.equal(lastReportedIndex(SERIES, 2, (e) => e.ashMaxMasl), 1);
  });

  it('is -1 when nothing earlier reported one', () => {
    assert.equal(lastReportedIndex([day('2026-11-01', gap)], 0), -1);
  });
});

describe('no null becomes 0', () => {
  it('says "Not reported" for every missing readout value', () => {
    const rows = readoutRows(SERIES[5]);
    const explosions = rows.find((r) => r.key === 'Explosions');
    assert.deepEqual(
      { value: explosions?.value, missing: explosions?.missing },
      { value: 'Not reported', missing: true },
    );
    const drift = rows.find((r) => r.key === 'Drift');
    assert.equal(drift?.value, 'Not reported');
  });

  it('never shows a 0 or a bare dash for a missing field', () => {
    const empty = day('2026-11-07', {
      ...gap, ashMinMasl: null, ashMaxMasl: null, driftKm: null, driftDirections: [], drainages: [],
    });
    for (const r of readoutRows(empty)) {
      assert.doesNotMatch(r.value, /^(0|—|–|-)?$/, `${r.key} shows "${r.value}"`);
      assert.equal(r.missing, true, `${r.key} should be marked missing`);
    }
  });

  it('keeps continuous emission distinct from a missing rate', () => {
    const rows = readoutRows(SERIES[3]);
    assert.equal(rows[0].value, 'continuous');
    assert.notEqual(rows[0].missing, true);
  });

  it('shows a drift heading without inventing a distance', () => {
    const rows = readoutRows(day('2026-11-08', { driftKm: null, driftDirections: ['SW'] }));
    const drift = rows.find((r) => r.key === 'Drift');
    assert.deepEqual([drift?.value, drift?.unit, drift?.missing], ['Not reported', 'heading SW', true]);
  });
});
