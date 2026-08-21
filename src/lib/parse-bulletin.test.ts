import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MALFORMED,
  PAROXYSM,
  QUIET,
  TYPICAL,
} from './__fixtures__/bulletins';
import { parseBulletin, parseSpanishNumber } from './parse-bulletin';

describe('parseSpanishNumber', () => {
  it('reads grouped thousands with either separator', () => {
    assert.equal(parseSpanishNumber('4,500'), 4500);
    assert.equal(parseSpanishNumber('4.500'), 4500);
    assert.equal(parseSpanishNumber('1,200'), 1200);
  });

  it('reads decimals with either separator', () => {
    assert.equal(parseSpanishNumber('1.1'), 1.1);
    assert.equal(parseSpanishNumber('1,1'), 1.1);
  });

  it('reads bare integers and rejects non-numbers', () => {
    assert.equal(parseSpanishNumber('40'), 40);
    assert.equal(parseSpanishNumber('n/a'), null);
    assert.equal(parseSpanishNumber(''), null);
  });
});

describe('parseBulletin — typical day', () => {
  const { parsed, warnings } = parseBulletin(TYPICAL);

  it('extracts the explosion rate range', () => {
    assert.deepEqual(parsed.explosionsPerHour, { min: 5, max: 8 });
  });

  it('reads the ash column, not the degassing altitude', () => {
    assert.deepEqual(parsed.ashColumnMasl, { min: 4500, max: 4800 });
  });

  it('extracts drift direction and distance', () => {
    assert.deepEqual(parsed.driftDirections.sort(), ['SW', 'W']);
    assert.equal(parsed.driftKm, 15);
  });

  it('does not mistake the word "ceniza" for the barranca of that name', () => {
    // Both appear in this bulletin; only the drainage clause should count.
    assert.deepEqual(parsed.drainages, ['Seca', 'Ceniza', 'Trinidad', 'Las Lajas']);
  });

  it('extracts incandescence as a range', () => {
    assert.deepEqual(parsed.incandescenceM, { min: 200, max: 300 });
  });

  it('identifies phenomena', () => {
    for (const p of ['explosions', 'rumbling', 'shockwaves', 'avalanches', 'degassing', 'incandescence']) {
      assert.ok(parsed.phenomena.includes(p as never), `expected ${p}`);
    }
  });

  it('reports no warnings on a well-formed bulletin', () => {
    assert.deepEqual(warnings, []);
  });
});

describe('parseBulletin — paroxysm', () => {
  const { parsed } = parseBulletin(PAROXYSM);

  it('handles "entre X y Y" phrasing', () => {
    assert.deepEqual(parsed.explosionsPerHour, { min: 12, max: 16 });
  });

  it('handles dot-grouped thousands in the ash column', () => {
    assert.deepEqual(parsed.ashColumnMasl, { min: 4700, max: 5200 });
  });

  it('extracts the lava flow length', () => {
    assert.equal(parsed.lavaFlowM, 1200);
  });

  it('matches barranca names without accents', () => {
    assert.ok(parsed.drainages.includes('Taniluyá'));
    assert.ok(parsed.drainages.includes('Las Lajas'));
    assert.ok(parsed.drainages.includes('El Jute'));
  });

  it('flags lahars and ashfall', () => {
    assert.ok(parsed.phenomena.includes('lahars'));
    assert.ok(parsed.phenomena.includes('ashfall'));
    assert.ok(parsed.phenomena.includes('lavaFlow'));
  });

  it('reads long-range drift', () => {
    assert.equal(parsed.driftKm, 40);
    assert.deepEqual(parsed.driftDirections, ['SW']);
  });
});

describe('parseBulletin — quiet day', () => {
  const { parsed, warnings } = parseBulletin(QUIET);

  it('treats a single figure as a degenerate range', () => {
    assert.deepEqual(parsed.explosionsPerHour, { min: 1, max: 1 });
  });

  it('warns about the fields it could not find', () => {
    assert.ok(warnings.includes('no-ash-column'));
    assert.ok(warnings.includes('no-drift-direction'));
  });
});

describe('parseBulletin — degradation', () => {
  it('returns nulls and warnings rather than throwing', () => {
    const { parsed, warnings } = parseBulletin(MALFORMED);
    assert.equal(parsed.explosionsPerHour, null);
    assert.equal(parsed.ashColumnMasl, null);
    assert.ok(warnings.length > 0);
  });

  it('survives empty input', () => {
    const { parsed, warnings } = parseBulletin('');
    assert.equal(parsed.explosionsPerHour, null);
    assert.deepEqual(parsed.drainages, []);
    assert.ok(warnings.includes('empty-bulletin-text'));
  });

  it('rejects an ash column below the summit as a misparse', () => {
    const { warnings } = parseBulletin(
      'columnas de ceniza a una altura de 1,200 msnm',
    );
    assert.ok(warnings.includes('ash-column-below-summit'));
  });
});
