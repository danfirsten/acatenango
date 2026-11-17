/**
 * Decides, frame by frame, whether the scene draws.
 *
 * The scene draws at most `cap` times a second. After a draw it also rests
 * for twice as long as that draw held the frame up, measured as how much
 * longer the next frame took than the display's own frame interval. On a fast
 * machine a draw costs next to nothing and this is simply the cap: every
 * other frame at 60 Hz, every fourth at 120 Hz. On a slow or busy one, where
 * software WebGL can hold each frame for a quarter of a second, it leaves two
 * frames in three free of WebGL work, so scrolling and clicks are never
 * starved.
 *
 * Pure: it only sees the timestamps it is given, so it can be tested without
 * a browser.
 */
export class FramePacer {
  private readonly minGap: number;
  /**
   * The display's frame interval: the shortest gap seen between frames,
   * starting from 60 Hz so a slow first draw isn't taken for the display.
   */
  private interval = 1000 / 60;
  private prev: number | null = null;
  private lastDraw = -Infinity;
  private drewLast = false;
  private restUntil = -Infinity;

  constructor(cap = 30) {
    this.minGap = 1000 / cap;
  }

  /** Call once per browser frame with its timestamp; true means draw in this frame. */
  frame(now: number): boolean {
    if (this.prev !== null) {
      const delta = now - this.prev;
      if (delta > 0) this.interval = Math.min(this.interval, Math.max(4, delta));
      if (this.drewLast) {
        // What the draw added beyond an ordinary frame.
        const cost = Math.max(0, delta - this.interval);
        this.restUntil = now + Math.min(1000, 2 * cost);
      }
    }
    this.prev = now;
    this.drewLast = false;
    if (now < this.restUntil) return false;
    // Half a frame of slack, so a 30 fps cap lands on every other 60 Hz frame
    // rather than every third.
    if (now - this.lastDraw < this.minGap - this.interval / 2) return false;
    this.lastDraw = now;
    this.drewLast = true;
    return true;
  }

  /** The loop stopped and is starting again: the gap since says nothing about cost. */
  reset(): void {
    this.prev = null;
    this.drewLast = false;
    this.restUntil = -Infinity;
  }
}
