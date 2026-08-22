import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bvdUrl, recentDates } from './bvd';
import { htmlToText } from './fetch-text';
import { FUEGO_PAGE_CERTAIN, documentMentionsDate, printedDates, scoreFuegoPage } from './ocr';

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

describe('printedDates', () => {
  it('reads Spanish long-form dates', () => {
    assert.deepEqual(printedDates('BOLETIN VULCANOLOGICO 21 de agosto de 2026'), ['2026-08-21']);
  });

  it('returns every date the scan carries, not just the first', () => {
    // Real page 2 of BVD-2026-08-21 has site furniture with its own date.
    const text = 'lunes, 17 de agosto de 2026 - 6:28 a.m. Editar ... boletín del 21 de agosto de 2026';
    assert.deepEqual(printedDates(text).sort(), ['2026-08-17', '2026-08-21']);
  });

  it('accepts both spellings of September', () => {
    assert.deepEqual(printedDates('1 de setiembre de 2026'), ['2026-09-01']);
  });

  it('ignores impossible days', () => {
    assert.deepEqual(printedDates('47 de agosto de 2026'), []);
  });
});

describe('documentMentionsDate', () => {
  it('accepts a bulletin whose cover names the date it is filed under', () => {
    assert.ok(documentMentionsDate(['BOLETIN 21 de agosto de 2026', 'Actividad...'], '2026-08-21'));
  });

  it('trusts the cover over site furniture on a later page', () => {
    // Real page 2 of BVD-2026-08-21 carries "lunes, 17 de agosto de 2026 ... Editar".
    assert.ok(documentMentionsDate(
      ['BOLETIN VULCANOLOGICO 21 de agosto de 2026',
       'lunes, 17 de agosto de 2026 - 6:28 a.m. Editar'],
      '2026-08-21',
    ));
  });

  it('rejects a stale bulletin left at another day’s URL', () => {
    assert.ok(!documentMentionsDate(['BOLETIN 19 de agosto de 2026', 'Actividad'], '2026-08-21'));
  });

  it('falls back to later pages when the cover has no legible date', () => {
    assert.ok(documentMentionsDate(['%%% garbled masthead %%%', 'del 21 de agosto de 2026'], '2026-08-21'));
  });

  it('accepts a bulletin with no legible date anywhere rather than discarding it', () => {
    assert.ok(documentMentionsDate(['garbled', 'Actividad: explosiones débiles'], '2026-08-21'));
  });
});

describe('Fuego page scoring', () => {
  it('scores a real Fuego page as certain', () => {
    assert.ok(
      scoreFuegoPage('El Observatorio del Volcán de Fuego (OVFGO) reporta ... Altura: 3763 msnm')
        >= FUEGO_PAGE_CERTAIN,
    );
  });

  it('never scores the other volcanoes in the same bulletin as Fuego', () => {
    assert.ok(scoreFuegoPage('El OVPAC reporta actividad fumarólica en el cráter Mackenney') < 1);
    assert.ok(scoreFuegoPage('El OVSAN reporta el domo Caliente del volcán Santiaguito') < 1);
  });

  it('does not treat a passing mention as the Fuego page', () => {
    // The cover lists all three volcanoes; it is not Fuego's activity page.
    assert.ok(
      scoreFuegoPage('BOLETIN VULCANOLOGICO DIARIO — Fuego, Santiaguito y Pacaya')
        < FUEGO_PAGE_CERTAIN,
    );
  });
});
