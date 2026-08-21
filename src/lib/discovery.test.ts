import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bvdUrl, recentDates } from './bvd';
import { htmlToText } from './fetch-text';

describe('bvdUrl', () => {
  it('builds the date-addressable bulletin URL', () => {
    assert.equal(
      bvdUrl('2026-08-21'),
      'https://insivumeh.gob.gt/wp-content/uploads/2026/08/BVD-2026-08-21.pdf',
    );
  });

  it('keeps the zero padding INSIVUMEH uses in both path and filename', () => {
    assert.equal(
      bvdUrl('2026-01-05'),
      'https://insivumeh.gob.gt/wp-content/uploads/2026/01/BVD-2026-01-05.pdf',
    );
  });
});

describe('recentDates', () => {
  it('counts back from the given day, most recent first', () => {
    assert.deepEqual(recentDates('2026-08-21', 3), ['2026-08-21', '2026-08-20', '2026-08-19']);
  });

  it('crosses a month boundary', () => {
    assert.deepEqual(recentDates('2026-03-02', 3), ['2026-03-02', '2026-03-01', '2026-02-28']);
  });

  it('handles a leap day', () => {
    assert.deepEqual(recentDates('2024-03-01', 2), ['2024-03-01', '2024-02-29']);
  });
});

describe('htmlToText', () => {
  it('drops scripts and styles', () => {
    assert.equal(htmlToText('<style>a{}</style><script>x()</script><p>Fuego</p>'), 'Fuego');
  });

  it('decodes entities and preserves block breaks', () => {
    assert.equal(htmlToText('<p>a &amp; b</p><p>c</p>'), 'a & b\nc');
  });
});
