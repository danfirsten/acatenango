/** True when the person has asked for less motion. Safe on the server. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Adds `is-in` once an element marked with `data-io` scrolls into view, which starts the
 * rise, fade and clip in css/motion.css. With reduced motion, everything is shown at once.
 * Returns a function that stops observing.
 */
export function observeReveals(root: ParentNode = document): () => void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-io]:not(.is-in)'))
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'))
    return () => {}
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
  )
  els.forEach((el) => io.observe(el))
  return () => io.disconnect()
}

/** Exponential ease-out, for counters and anything driven frame by frame. */
export const easeOutExpo = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

/** The curves as numbers, for JS animation libraries (cubic-bezier control points). */
export const curves = {
  out: [0.23, 1, 0.32, 1],
  expo: [0.16, 1, 0.3, 1],
  inout: [0.77, 0, 0.175, 1],
  drawer: [0.32, 0.72, 0, 1],
} as const

/** Sets data-theme on <html>: 'light', 'dark', or 'auto' (follow the system). */
export function setTheme(theme: 'light' | 'dark' | 'auto'): void {
  document.documentElement.setAttribute('data-theme', theme)
}
