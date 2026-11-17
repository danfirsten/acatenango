import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HATCH_MIN_KM, HATCH_PX, TERRAIN_FRAG, hatchScales } from './engraving';

/** Ground covered by one CSS pixel, in km, from a camera at the camp to the far valley. */
const DISTANCES = [0.00002, 0.0001, 0.00037, 0.001, 0.0042, 0.01, 0.03, 0.12];

describe('hatchScales', () => {
  it('keeps the visible lines between one and two target gaps apart at any distance', () => {
    for (const perPx of DISTANCES) {
      const { fine, coarse, fade } = hatchScales(perPx);
      const finePx = fine / perPx;
      const coarsePx = coarse / perPx;
      // Fine lines are HATCH_PX apart when fully drawn, and fade out as they close to half that.
      assert.ok(finePx <= HATCH_PX + 1e-9 && finePx >= HATCH_PX / 2 - 1e-9, `fine ${finePx}px at ${perPx}`);
      assert.ok(coarsePx >= HATCH_PX - 1e-9 && coarsePx <= HATCH_PX * 2 + 1e-9, `coarse ${coarsePx}px at ${perPx}`);
      assert.ok(fade >= 0 && fade < 1);
    }
  });

  it('does not coarsen close up: at the camp the lines stay about 7 px apart', () => {
    // From camp the nearest ground is tens of metres away: a few cm per pixel.
    const perPx = 0.00003;
    const { fine, coarse, fade } = hatchScales(perPx);
    const effectivePx = (fade < 0.5 ? fine : coarse) / perPx;
    assert.ok(effectivePx <= HATCH_PX * 2, `close up the gap is ${effectivePx}px`);
    assert.ok(fine < 0.001, 'ground spacing goes below a metre when it needs to');
  });

  it('blends without popping: the picture is the same either side of a scale change', () => {
    // Just below a power-of-two boundary the fine lines have all but faded and
    // the coarse lines carry the drawing; just above, those coarse lines are
    // the new fine lines at full strength.
    const boundary = (HATCH_MIN_KM * 2 ** 6) / HATCH_PX;
    const below = hatchScales(boundary * 0.9999);
    const above = hatchScales(boundary * 1.0001);
    assert.ok(below.fade > 0.99);
    assert.ok(above.fade < 0.01);
    assert.ok(Math.abs(below.coarse - above.fine) < 1e-12);
  });

  it('accounts for the pixel ratio', () => {
    const a = hatchScales(0.001, 1);
    const b = hatchScales(0.0005, 2);
    assert.deepEqual(a, b);
  });
});

describe('TERRAIN_FRAG', () => {
  it('uses the same hatching constants as hatchScales', () => {
    assert.match(TERRAIN_FRAG, new RegExp(`HATCH_PX = ${HATCH_PX}\\.0;`));
    assert.match(TERRAIN_FRAG, new RegExp(`HATCH_MIN = ${HATCH_MIN_KM};`));
  });

  it('draws contours every 100 m and index contours every 500 m', () => {
    assert.match(TERRAIN_FRAG, /contour\(metres, perM, 100\.0,/);
    assert.match(TERRAIN_FRAG, /contour\(metres, perM, 500\.0,/);
  });

  it('fades to the background colour, with no haze colour left', () => {
    assert.match(TERRAIN_FRAG, /mix\(uBackground, uLine,/);
    assert.doesNotMatch(TERRAIN_FRAG, /Haze|uSkyColor|uSunColor/);
  });
});
