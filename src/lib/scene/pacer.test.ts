import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FramePacer } from './pacer';

/**
 * Runs the pacer against a simulated display: frames come every `interval`
 * ms, and a frame with a draw in it is held up by `drawCost` ms more.
 */
function simulate(interval: number, drawCost: number, seconds = 10) {
  const pacer = new FramePacer(30);
  let t = 0;
  let frames = 0;
  let draws = 0;
  while (t < seconds * 1000) {
    frames++;
    const draw = pacer.frame(t);
    if (draw) draws++;
    t += interval + (draw ? drawCost : 0);
  }
  return { frames, draws, drawsPerSecond: draws / seconds, frameShare: draws / frames };
}

describe('FramePacer', () => {
  it('draws 30 times a second on a 60 Hz display when drawing is cheap', () => {
    const r = simulate(1000 / 60, 0.5);
    assert.ok(r.drawsPerSecond > 29 && r.drawsPerSecond <= 30.5, `${r.drawsPerSecond} draws a second`);
  });

  it('draws 30 times a second on a 120 Hz display, not 40 or 24', () => {
    const r = simulate(1000 / 120, 0.5);
    assert.ok(r.drawsPerSecond > 29 && r.drawsPerSecond <= 30.5, `${r.drawsPerSecond} draws a second`);
  });

  it('does not mistake the wait for the next frame for the cost of a draw', () => {
    // A free draw must not slow the scene below the cap.
    const r = simulate(1000 / 60, 0);
    assert.ok(r.drawsPerSecond > 29, `${r.drawsPerSecond} draws a second`);
  });

  it('leaves four frames in five free when each draw holds a frame for a quarter of a second', () => {
    const r = simulate(1000 / 60, 250);
    assert.ok(r.frameShare <= 0.2, `draws in ${(r.frameShare * 100).toFixed(0)}% of frames`);
    assert.ok(r.draws > 0, 'still animates');
    // And the free time adds up to about four times the time spent drawing.
    const busy = r.draws * 250;
    assert.ok(10_000 - busy >= 4 * busy * 0.9, `busy ${busy} ms of 10 s`);
  });

  it('starts afresh after the loop stops, rather than reading the pause as a slow draw', () => {
    const pacer = new FramePacer(30);
    assert.equal(pacer.frame(0), true);
    pacer.reset();
    // A long pause, then the loop resumes: it draws straight away.
    assert.equal(pacer.frame(60_000), true);
  });
});
