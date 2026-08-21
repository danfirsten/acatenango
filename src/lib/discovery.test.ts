import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractLinks, scoreBulletinLink } from '../../scripts/collect';
import { htmlToText } from './fetch-text';

describe('extractLinks', () => {
  it('resolves relative hrefs against the page URL', () => {
    const links = extractLinks(
      '<a href="/boletin-fuego">Boletín Fuego</a>',
      'https://insivumeh.gob.gt/',
    );
    assert.deepEqual(links, [
      { href: 'https://insivumeh.gob.gt/boletin-fuego', text: 'Boletín Fuego' },
    ]);
  });

  it('ignores non-http schemes', () => {
    const links = extractLinks(
      '<a href="mailto:a@b.gt">mail</a><a href="javascript:x()">js</a>',
      'https://example.com/',
    );
    assert.deepEqual(links, []);
  });
});

describe('scoreBulletinLink', () => {
  it('ranks a Fuego bulletin above a generic page', () => {
    const bulletin = scoreBulletinLink(
      'https://insivumeh.gob.gt/actualizacion-de-la-actividad-del-volcan-de-fuego-hoy-04-de-agosto/',
      'Actualización de la actividad del Volcán de Fuego',
    );
    const generic = scoreBulletinLink('https://insivumeh.gob.gt/contacto/', 'Contacto');
    assert.ok(bulletin > generic);
    assert.ok(bulletin >= 4, `expected a passing score, got ${bulletin}`);
  });

  it('rejects bulletins for the other monitored volcanoes', () => {
    const santiaguito = scoreBulletinLink(
      'https://insivumeh.gob.gt/boletin-vulcanologico-santiaguito/',
      'Boletín vulcanológico Santiaguito',
    );
    assert.ok(santiaguito < 4, `Santiaguito should not qualify, got ${santiaguito}`);
  });
});

describe('htmlToText', () => {
  it('drops scripts and styles', () => {
    const text = htmlToText('<style>a{}</style><script>x()</script><p>Fuego</p>');
    assert.equal(text, 'Fuego');
  });

  it('decodes entities and preserves block breaks', () => {
    assert.equal(htmlToText('<p>a &amp; b</p><p>c</p>'), 'a & b\nc');
  });
});
