import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import Hoop, { HOOP_BODY, HOOP_EYES } from './Hoop';
import ImageTag from './ImageTag';
import Label from './Label';
import Mark, { MARK_CLASS, type MarkKind } from './Mark';
import Pill from './Pill';

const css = readFileSync(new URL('../../../vendor/ink-and-paper/css/components.css', import.meta.url), 'utf8');
const globals = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

describe('Mark', () => {
  const kinds: MarkKind[] = ['solid', 'ring', 'hatched', 'dotted', 'half'];

  it('draws each of the five marks with the vendored class', () => {
    for (const kind of kinds) {
      const html = renderToStaticMarkup(h(Mark, { kind }));
      assert.match(html, new RegExp(`class="mark ${MARK_CLASS[kind]}"`));
      assert.match(css, new RegExp(`\\.${MARK_CLASS[kind]} \\{`), `${MARK_CLASS[kind]} is styled by the system`);
    }
    assert.equal(new Set(Object.values(MARK_CLASS)).size, 5);
  });

  it('follows the system: hatched is mark 4 and dotted is mark 5', () => {
    assert.equal(MARK_CLASS.hatched, 'mark-4');
    assert.equal(MARK_CLASS.dotted, 'mark-5');
    assert.equal(MARK_CLASS.half, 'mark-3');
  });

  it('is hidden beside words, and read out when labelled', () => {
    assert.match(renderToStaticMarkup(h(Mark, { kind: 'hatched' })), /aria-hidden="true"/);
    const labelled = renderToStaticMarkup(h(Mark, { kind: 'hatched', label: 'Not reported' }));
    assert.match(labelled, /role="img"/);
    assert.match(labelled, /aria-label="Not reported"/);
    assert.doesNotMatch(labelled, /aria-hidden/);
  });
});

describe('Hoop', () => {
  const svg = readFileSync(new URL('../../../vendor/ink-and-paper/characters/hoop.svg', import.meta.url), 'utf8');

  it('is the vendored drawing', () => {
    assert.ok(svg.includes(`d="${HOOP_BODY}"`), 'body matches hoop.svg');
    assert.ok(svg.includes(`d="${HOOP_EYES}"`), 'eyes match hoop.svg');
  });

  it('draws in currentColor, awake by default', () => {
    const html = renderToStaticMarkup(h(Hoop));
    assert.match(html, /data-state="awake"/);
    assert.match(html, /stroke="currentColor"/);
    assert.match(html, /fill="currentColor"/);
    assert.doesNotMatch(html, /#[0-9a-f]{3,6}/i);
    assert.match(html, /aria-hidden="true"/);
  });

  it('asleep, its eyes are closed lines', () => {
    const html = renderToStaticMarkup(h(Hoop, { state: 'asleep', size: 20, label: 'Offline' }));
    assert.match(html, /data-state="asleep"/);
    assert.ok(!html.includes(HOOP_EYES), 'no open eyes');
    assert.match(html, /stroke-linecap="round"/);
    assert.match(html, /width="20"/);
    assert.match(html, /aria-label="Offline"/);
  });
});

describe('Pill', () => {
  it('is a solid ink button by default', () => {
    const html = renderToStaticMarkup(h(Pill, null, 'See the record'));
    assert.match(html, /^<button class="pill pill-solid press" type="button">See the record<\/button>$/);
  });

  it('is an outline link, compact, with ↗ when it leaves the site', () => {
    const html = renderToStaticMarkup(
      h(Pill, { variant: 'outline', compact: true, external: true, href: 'https://conred.gob.gt/alertas/', children: 'CONRED' }));
    assert.match(html, /^<a class="pill pill-line pill-compact press" href="https:\/\/conred.gob.gt\/alertas\/">/);
    assert.match(html, /CONRED<span aria-hidden="true">↗<\/span><\/a>$/);
  });

  it('is at least 48 px tall, and 44 px compact', () => {
    assert.match(css, /\.pill \{[^}]*min-height: 48px/);
    assert.match(globals, /\.pill-compact \{[^}]*min-height: 44px/);
  });
});

describe('ImageTag and Label', () => {
  it('use the system classes', () => {
    assert.equal(renderToStaticMarkup(h(ImageTag, null, 'Orbit · 16 Nov')), '<span class="chip-tag">Orbit · 16 Nov</span>');
    assert.equal(renderToStaticMarkup(h(Label, null, 'Column')), '<span class="label">Column</span>');
    assert.equal(renderToStaticMarkup(h(Label, { as: 'dt', className: 'x', children: 'Drift' })), '<dt class="label x">Drift</dt>');
  });

  it('keep labels in sentence case inside the page, and never below 11 px', () => {
    assert.match(globals, /\[data-surface='app'\] \.chip-tag \{[^}]*text-transform: none/);
    for (const m of globals.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      assert.ok(Number(m[1]) >= 11, `font-size ${m[1]}px in globals.css`);
    }
  });
});
