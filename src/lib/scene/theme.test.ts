import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { INK, PAPER, luminance, parseCssColor, resolveTheme, sameTheme, sceneTheme } from './theme';

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

describe('resolveTheme', () => {
  it('draws on paper by default and on ink when the system is dark', () => {
    assert.equal(resolveTheme({ bg: null, dataTheme: 'auto', prefersDark: false }).mode, 'paper');
    assert.equal(resolveTheme({ bg: null, dataTheme: 'auto', prefersDark: true }).mode, 'ink');
    assert.equal(resolveTheme({ bg: null, dataTheme: undefined, prefersDark: true }).mode, 'ink');
  });

  it('lets data-theme force a theme over the system setting', () => {
    assert.equal(resolveTheme({ bg: null, dataTheme: 'dark', prefersDark: false }).mode, 'ink');
    assert.equal(resolveTheme({ bg: null, dataTheme: 'light', prefersDark: true }).mode, 'paper');
  });

  it('falls back to the paper and ink tokens when the page has no --bg', () => {
    assert.equal(resolveTheme({ bg: '', dataTheme: 'light', prefersDark: false }).background, PAPER);
    assert.equal(resolveTheme({ bg: '  ', dataTheme: 'dark', prefersDark: false }).background, INK);
  });

  it("takes the sky from the page's computed --bg, and the theme with it", () => {
    const paper = resolveTheme({ bg: ' #f7f7f4', dataTheme: 'auto', prefersDark: true });
    assert.equal(paper.mode, 'paper');
    assert.equal(paper.background, 0xf7f7f4);
    const ink = resolveTheme({ bg: 'rgb(11, 11, 11)', dataTheme: 'auto', prefersDark: false });
    assert.equal(ink.mode, 'ink');
    assert.equal(ink.background, 0x0b0b0b);
  });

  it('notices a change of background within the same theme', () => {
    const a = resolveTheme({ bg: '#f7f7f4', dataTheme: 'auto', prefersDark: false });
    const b = resolveTheme({ bg: '#ffffff', dataTheme: 'auto', prefersDark: false });
    assert.equal(sameTheme(a, a), true);
    assert.equal(sameTheme(a, b), false);
  });
});

describe('sceneTheme', () => {
  it('draws ink lines on paper and light lines on ink', () => {
    const paper = sceneTheme('paper');
    const ink = sceneTheme('ink');
    assert.ok(luminance(paper.line) < luminance(paper.background), 'paper: lines darker than the ground');
    assert.ok(luminance(ink.line) > luminance(ink.background), 'ink: lines lighter than the ground');
  });

  it('draws thinner, quieter lines on ink than on paper', () => {
    const paper = sceneTheme('paper');
    const ink = sceneTheme('ink');
    assert.ok(ink.hatchWidth < paper.hatchWidth);
    assert.ok(ink.contourWidth < paper.contourWidth);
    assert.ok(ink.lineStrength < paper.lineStrength);
  });

  it('makes the plume a warm grey ash in both themes, never blue-grey', () => {
    for (const mode of ['paper', 'ink'] as const) {
      const [r, g, b] = rgb(sceneTheme(mode).ash);
      assert.ok(r >= g && g >= b, `${mode}: warm (r ${r} ≥ g ${g} ≥ b ${b})`);
      assert.ok(r - b <= 24, `${mode}: a grey, not a colour (r - b = ${r - b})`);
      assert.ok(r - b >= 6, `${mode}: warm, not neutral (r - b = ${r - b})`);
    }
  });

  it('lays the ash lighter on paper, where it reads as a wash', () => {
    assert.ok(sceneTheme('paper').plumeOpacity < sceneTheme('ink').plumeOpacity);
    assert.ok(sceneTheme('paper').plumeOpacity > 0.4, 'still clearly a plume');
  });

  it('keeps the vent ember orange in both themes', () => {
    for (const mode of ['paper', 'ink'] as const) {
      const [r, g, b] = rgb(sceneTheme(mode).ember);
      assert.ok(r > 200 && g > 60 && g < 160 && b < 80, `${mode}: ember is orange (${r}, ${g}, ${b})`);
    }
  });
});

describe('parseCssColor', () => {
  it('reads the forms getComputedStyle returns', () => {
    assert.equal(parseCssColor('#0b0b0b'), 0x0b0b0b);
    assert.equal(parseCssColor('#FFF'), 0xffffff);
    assert.equal(parseCssColor('rgb(247, 247, 244)'), 0xf7f7f4);
    assert.equal(parseCssColor('rgba(247, 247, 244, 1)'), 0xf7f7f4);
    assert.equal(parseCssColor('rgb(247 247 244 / 0.5)'), 0xf7f7f4);
  });

  it('ignores what it cannot use', () => {
    assert.equal(parseCssColor(''), null);
    assert.equal(parseCssColor('var(--paper)'), null);
    assert.equal(parseCssColor('rgba(0, 0, 0, 0)'), null);
    assert.equal(parseCssColor('oklch(0.98 0 0)'), null);
  });
});
