import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bulletinAge } from './bulletin-age';

const at = (iso: string) => new Date(iso);

test('same Guatemala day reads as today', () => {
  assert.deepEqual(bulletinAge('2026-11-16', at('2026-11-16T15:00:00Z')), {
    days: 0, label: 'today', behind: false,
  });
});

test('uses the Guatemala calendar day, not UTC', () => {
  // 02:00 UTC on the 16th is still the evening of the 15th in Guatemala.
  assert.equal(bulletinAge('2026-11-15', at('2026-11-16T02:00:00Z'))?.label, 'today');
});

test('one day is singular', () => {
  assert.equal(bulletinAge('2026-11-15', at('2026-11-16T15:00:00Z'))?.label, '1 day ago');
});

test('two days is not yet behind, three is', () => {
  const two = bulletinAge('2026-11-14', at('2026-11-16T15:00:00Z'));
  assert.equal(two?.label, '2 days ago');
  assert.equal(two?.behind, false);
  const three = bulletinAge('2026-11-13', at('2026-11-16T15:00:00Z'));
  assert.equal(three?.label, '3 days ago');
  assert.equal(three?.behind, true);
});

test('a future or unreadable date gives no age', () => {
  assert.equal(bulletinAge('2026-11-20', at('2026-11-16T15:00:00Z')), null);
  assert.equal(bulletinAge('nope', at('2026-11-16T15:00:00Z')), null);
});
