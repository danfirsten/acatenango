/**
 * The scene's two themes. Ink and paper has no accent colour, so the terrain
 * is drawn like an engraving in the page's own black and white: on paper the
 * lines are ink and mark shadow, on ink they are light and mark light. Only the
 * lava, the crater and the embers keep colour; the plume is a warm grey ash.
 *
 * The page owns the theme (`data-theme` on <html> and the system setting), so
 * the scene reads it from the document rather than being told, and follows it
 * live. Everything here except `readPageTheme` and `watchPageTheme` is pure.
 */

export type SceneMode = 'paper' | 'ink';

/** Fallbacks from vendor/ink-and-paper/tokens/tokens.css, for a page with no --bg. */
export const PAPER = 0xf7f7f4;
export const INK = 0x0b0b0b;
/** The light text colour on ink (`--ink-text`), used for lines on ink. */
export const INK_TEXT = 0xf2f2ee;

export interface SceneTheme {
  mode: SceneMode;
  /** The page's `--bg`: the sky, and what far ground fades to. */
  background: number;
  /** The engraving's line colour. */
  line: number;
  /** Hatching half-width in device pixels. */
  hatchWidth: number;
  /** Contour half-width in device pixels; index contours are drawn heavier. */
  contourWidth: number;
  /** How strongly lines show at full tone, 0 to 1. */
  lineStrength: number;
  /** Plume colour once it has cooled: a warm grey ash in both themes. */
  ash: number;
  /** Fresh ash at the vent still carries heat. */
  ember: number;
  /** Embers glow by adding light on ink; on paper adding light washes out to white. */
  emberAdditive: boolean;
}

export function sceneTheme(mode: SceneMode, background?: number): SceneTheme {
  if (mode === 'ink') {
    return {
      mode,
      background: background ?? INK,
      line: INK_TEXT,
      // Light lines on ink read heavier than ink on paper; draw them thinner.
      hatchWidth: 0.36,
      contourWidth: 0.5,
      lineStrength: 0.3,
      ash: 0x8f877e,
      ember: 0xff7a33,
      emberAdditive: true,
    };
  }
  return {
    mode,
    background: background ?? PAPER,
    line: INK,
    hatchWidth: 0.6,
    contourWidth: 0.62,
    lineStrength: 0.86,
    ash: 0x8a8279,
    ember: 0xff7a33,
    emberAdditive: false,
  };
}

/** Parses the colour forms getComputedStyle hands back: hex and rgb()/rgba(). */
export function parseCssColor(value: string): number | null {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return parseInt(h, 16);
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(v);
  if (rgb) {
    // A transparent --bg says nothing about the page; ignore it.
    if (rgb[4] !== undefined && parseFloat(rgb[4]) === 0) return null;
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((n) => Math.max(0, Math.min(255, Math.round(parseFloat(n)))));
    return (r << 16) | (g << 8) | b;
  }
  return null;
}

/** Relative luminance (WCAG) of a 0xrrggbb colour. */
export function luminance(color: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((color >> 16) & 255) + 0.7152 * lin((color >> 8) & 255) + 0.0722 * lin(color & 255);
}

/**
 * Which theme the page is in. A real `--bg` decides it, so the scene always
 * matches the page around it. Without one, `data-theme` does, and `auto` (or
 * no attribute) follows the system setting.
 */
export function resolveTheme(input: {
  bg: string | null | undefined;
  dataTheme: string | null | undefined;
  prefersDark: boolean;
}): SceneTheme {
  const bg = input.bg ? parseCssColor(input.bg) : null;
  if (bg !== null) return sceneTheme(luminance(bg) < 0.3 ? 'ink' : 'paper', bg);
  const t = input.dataTheme;
  const mode: SceneMode = t === 'dark' ? 'ink' : t === 'light' ? 'paper' : input.prefersDark ? 'ink' : 'paper';
  return sceneTheme(mode);
}

export function sameTheme(a: SceneTheme, b: SceneTheme): boolean {
  return a.mode === b.mode && a.background === b.background;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Reads the theme from the live document. The --bg is read where the scene
 * sits (its canvas), so a section that sets its own theme is matched too.
 * Browser only.
 */
export function readPageTheme(at: Element = document.documentElement): SceneTheme {
  const root = document.documentElement;
  return resolveTheme({
    bg: getComputedStyle(at).getPropertyValue('--bg'),
    dataTheme: root.dataset.theme,
    prefersDark: window.matchMedia?.(DARK_QUERY).matches ?? false,
  });
}

/**
 * Calls back whenever the page's theme may have changed: `data-theme`, a class
 * or inline style on <html> (where a theme switch would set it), or the system
 * setting. Returns the function that stops watching. Browser only.
 */
export function watchPageTheme(
  onChange: (theme: SceneTheme) => void,
  at: Element = document.documentElement,
): () => void {
  let current = readPageTheme(at);
  const check = () => {
    const next = readPageTheme(at);
    if (sameTheme(next, current)) return;
    current = next;
    onChange(next);
  };
  const observer = new MutationObserver(check);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  const media = window.matchMedia?.(DARK_QUERY);
  media?.addEventListener('change', check);
  return () => {
    observer.disconnect();
    media?.removeEventListener('change', check);
  };
}
