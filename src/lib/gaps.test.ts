import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dateRange, isDefinitelyAbsent, mergeGaps, missingDates, parseGaps, resolveRange, serializeGaps } from './gaps';

const g = (date: string, lastTried = '2026-11-16T00:00:00Z') => ({ date, reason: 'not served', lastTried });

test('dateRange is inclusive and crosses month and leap boundaries', () => {
  assert.deepEqual(dateRange('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(dateRange('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29', '2028-03-01']);
  assert.deepEqual(dateRange('2026-06-29', '2026-06-29'), ['2026-06-29']);
  assert.deepEqual(dateRange('2026-06-30', '2026-06-29'), []);
});

test('dateRange rejects malformed dates', () => {
  assert.throws(() => dateRange('June 1', '2026-06-02'));
});

test('missingDates lists only days without a record', () => {
  assert.deepEqual(missingDates(['2026-06-28', '2026-06-30'], '2026-06-28', '2026-07-01'), ['2026-06-29', '2026-07-01']);
});

test('parseGaps tolerates missing, broken and partial files', () => {
  assert.deepEqual(parseGaps(null), []);
  assert.deepEqual(parseGaps('not json'), []);
  assert.deepEqual(parseGaps('{"gaps": 3}'), []);
  const text = JSON.stringify({ gaps: [g('2026-08-22'), { date: 'x' }, g('2026-08-18')] });
  assert.deepEqual(parseGaps(text).map((x) => x.date), ['2026-08-18', '2026-08-22']);
});

test('mergeGaps refreshes lastTried, drops recovered days and sorts', () => {
  const existing = [g('2026-08-22', 'old'), g('2026-08-18')];
  const found = [g('2026-08-22', 'new'), g('2026-06-29')];
  const merged = mergeGaps(existing, found, ['2026-08-18']);
  assert.deepEqual(merged.map((x) => x.date), ['2026-06-29', '2026-08-22']);
  assert.equal(merged[1].lastTried, 'new');
});

test('serializeGaps round-trips', () => {
  const gaps = [g('2026-08-18')];
  assert.deepEqual(parseGaps(serializeGaps(gaps)), gaps);
});

test('resolveRange reads flags, a day count, or defaults to the first record', () => {
  assert.deepEqual(resolveRange(['--from', '2026-10-12', '--to', '2026-10-30'], '2026-11-16', null), { from: '2026-10-12', to: '2026-10-30' });
  assert.deepEqual(resolveRange(['--from', '2026-10-12'], '2026-11-16', null), { from: '2026-10-12', to: '2026-11-16' });
  assert.deepEqual(resolveRange(['3'], '2026-11-16', null), { from: '2026-11-14', to: '2026-11-16' });
  assert.deepEqual(resolveRange([], '2026-11-16', '2026-06-08'), { from: '2026-06-08', to: '2026-11-16' });
});

test('only a 404 or 410 counts as a day INSIVUMEH does not serve', () => {
  assert.equal(isDefinitelyAbsent(new Error('https://x/a.pdf returned 404')), true);
  assert.equal(isDefinitelyAbsent(new Error('https://x/a.pdf returned 410')), true);
  assert.equal(isDefinitelyAbsent(new Error('https://x/a.pdf returned 503')), false);
  assert.equal(isDefinitelyAbsent(new Error('https://x/a.pdf returned 429')), false);
  assert.equal(isDefinitelyAbsent(new TypeError('fetch failed')), false);
  assert.equal(isDefinitelyAbsent('returned 404'), false);
});
