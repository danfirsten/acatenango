import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fitCamera } from './massif';

// Fuego and Acatenango are about 2.7 km apart in scene units (km).
const GAP = 2.7;
const DISTANCE = 18;

describe('fitCamera', () => {
  it('leaves a wide screen alone', () => {
    const fit = fitCamera(1.6, GAP, DISTANCE);
    assert.equal(fit.orbitScale, 1);
    assert.equal(fit.campBack, 1);
    assert.equal(fit.lift, 0);
  });

  it('stands further back and widens the lens as the canvas gets taller', () => {
    const tablet = fitCamera(768 / 1024, GAP, DISTANCE);
    const phone = fitCamera(390 / 844, GAP, DISTANCE);
    assert.ok(phone.orbitScale >= tablet.orbitScale);
    assert.ok(phone.campFov > tablet.campFov);
    assert.ok(phone.campBack > 1);
  });

  it('keeps both summits inside the horizontal field of view on a phone', () => {
    const aspect = 390 / 844;
    const fit = fitCamera(aspect, GAP, DISTANCE);
    const halfWidth = Math.tan((42 / 2) * (Math.PI / 180)) * aspect * DISTANCE * fit.orbitScale;
    // Each summit is at most half the gap from the orbit centre at any angle.
    assert.ok(halfWidth >= (GAP / 2) * 1.5, `half width ${halfWidth} must hold the summits`);
  });

  it('lifts the picture on narrow screens so the readout sits below the summits', () => {
    assert.ok(fitCamera(390 / 844, GAP, DISTANCE).lift > 0);
    assert.ok(fitCamera(768 / 1024, GAP, DISTANCE).lift > 0);
  });
});
