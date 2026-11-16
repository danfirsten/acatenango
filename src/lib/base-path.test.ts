import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normaliseBasePath, siteUrl, withBase } from './base-path';

describe('normaliseBasePath', () => {
  it('is empty when unset, blank or the root', () => {
    assert.equal(normaliseBasePath(undefined), '');
    assert.equal(normaliseBasePath(''), '');
    assert.equal(normaliseBasePath('/'), '');
  });

  it('gives one leading slash and no trailing one', () => {
    assert.equal(normaliseBasePath('/acatenango'), '/acatenango');
    assert.equal(normaliseBasePath('acatenango/'), '/acatenango');
    assert.equal(normaliseBasePath('//acatenango//'), '/acatenango');
  });
});

describe('withBase', () => {
  it('prefixes root-absolute paths', () => {
    assert.equal(withBase('/terrain/massif.png', '/acatenango'), '/acatenango/terrain/massif.png');
    assert.equal(withBase('/sw.js', ''), '/sw.js');
  });

  it('refuses relative paths, which would resolve against the page instead', () => {
    assert.throws(() => withBase('terrain/massif.png', '/acatenango'));
  });
});

describe('siteUrl', () => {
  it('keeps og.png inside the base path even without a trailing slash', () => {
    const url = siteUrl('https://danfirsten.github.io/acatenango', 'https://x.test/');
    assert.equal(url, 'https://danfirsten.github.io/acatenango/');
    assert.equal(new URL('og.png', url).href, 'https://danfirsten.github.io/acatenango/og.png');
  });

  it('falls back when unset or blank', () => {
    assert.equal(siteUrl(undefined, 'https://x.test/a/'), 'https://x.test/a/');
    assert.equal(siteUrl('  ', 'https://x.test/a'), 'https://x.test/a/');
  });
});
