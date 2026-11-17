import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { MANIFEST_COLOR, THEME_COLOR } from './theme';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('theme colour', () => {
  it('is paper by day and ink after dark', () => {
    assert.deepEqual(THEME_COLOR, [
      { media: '(prefers-color-scheme: light)', color: '#f7f7f4' },
      { media: '(prefers-color-scheme: dark)', color: '#0b0b0b' },
    ]);
  });

  it('the manifest carries paper', () => {
    const manifest = JSON.parse(read('../../public/manifest.webmanifest'));
    assert.equal(manifest.theme_color.toLowerCase(), MANIFEST_COLOR);
    assert.equal(manifest.background_color.toLowerCase(), MANIFEST_COLOR);
  });
});

describe('the stylesheet', () => {
  const globals = read('../app/globals.css');

  it('imports the vendored ink and paper system once, first', () => {
    const imports = [...globals.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    assert.deepEqual(imports, ['../../vendor/ink-and-paper/css/index.css']);
    assert.match(globals.trimStart(), /^(\/\*[\s\S]*?\*\/\s*)?@import/);
  });

  it('keeps no palette hex or old Fuego token', () => {
    assert.doesNotMatch(globals, /#[0-9a-f]{3,8}\b/i, 'a hex colour');
    assert.doesNotMatch(globals, /--(ember|ground|ash|label|body)\b/, 'an old token');
    assert.doesNotMatch(globals, /barlow/i);
    // Palette names belong to the tokens; Fuego's rules use the theme roles.
    assert.doesNotMatch(globals, /var\(--(ink|paper|white|mute|line|well|ink-[a-z-]+|warm)\)/);
  });

  it('keeps the orange out of the page', () => {
    assert.doesNotMatch(globals, /orange|ember|rgb\(\s*2[0-9]{2}\s/i);
  });
});

describe('UI code', () => {
  it('names no palette hex, old token or Barlow outside the scene', async () => {
    const { readdirSync } = await import('node:fs');
    const files = [
      ...readdirSync(new URL('../components/', import.meta.url), { recursive: true, encoding: 'utf8' })
        .filter((f) => f.endsWith('.tsx')).map((f) => `../components/${f}`),
      '../i18n/document.tsx',
      '../app/global-not-found.tsx',
      '../standalone/entry.ts',
    ];
    assert.ok(files.length > 10);
    for (const f of files) {
      const src = read(f);
      assert.doesNotMatch(src, /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b(?![\w-])/i, `${f} has a hex colour`);
      assert.doesNotMatch(src, /barlow|--ember|--ground|--ash\b/i, `${f} has an old token`);
    }
  });
});
