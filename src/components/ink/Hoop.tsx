/**
 * Hoop, the ring: ink and paper's character for tools that watch
 * (vendor/ink-and-paper/characters/hoop.svg). Drawn in currentColor so it is
 * always the opposite of what is under it. Asleep, its eyes are closed lines:
 * a still drawing, never a loop.
 */

/** Hoop's body, copied from the vendored drawing (a test keeps the two the same). */
export const HOOP_BODY =
  'M0,-14C8.2,-14 14.5,-8 14.5,1C14.5,9.2 8,13.6 0,13.6C-8,13.6 -14.5,9.2 -14.5,1C-14.5,-8 -8.2,-14 0,-14Z';
/** Open eyes, from the same drawing. */
export const HOOP_EYES =
  'M-6.6,-1.4a1.6,2.9 0 1,0 3.2,0a1.6,2.9 0 1,0 -3.2,0Z M3.4,-1.4a1.6,2.9 0 1,0 3.2,0a1.6,2.9 0 1,0 -3.2,0Z';
/** Closed eyes: two short lines at the same height and width as the open ones. */
export const HOOP_EYES_ASLEEP = 'M-6.6,-0.6Q-5,0.8 -3.4,-0.6 M3.4,-0.6Q5,0.8 6.6,-0.6';

export default function Hoop({ state = 'awake', size = 24, label }: {
  state?: 'awake' | 'asleep';
  /** Width and height in CSS pixels. */
  size?: number;
  /** Read out when given; otherwise Hoop is decoration beside words. */
  label?: string;
}) {
  return (
    <svg
      className="hoop"
      data-state={state}
      viewBox="-16 -16 32 32"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path fill="none" stroke="currentColor" strokeWidth={1.8} d={HOOP_BODY} />
      {state === 'awake' ? (
        <path fill="currentColor" d={HOOP_EYES} />
      ) : (
        <path fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" d={HOOP_EYES_ASLEEP} />
      )}
    </svg>
  );
}
