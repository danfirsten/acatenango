import tokens from '../../vendor/ink-and-paper/tokens/tokens.json';

/**
 * The browser chrome's colour, from ink and paper's own theme roles: paper by
 * day and ink after dark, following the system like `data-theme="auto"`.
 * Read from the vendored tokens so it can never drift from the page.
 */
export const THEME_COLOR = [
  { media: '(prefers-color-scheme: light)', color: tokens.theme.light.bg },
  { media: '(prefers-color-scheme: dark)', color: tokens.theme.dark.bg },
];

/** One colour for the web manifest, which has no media queries: paper, the default theme. */
export const MANIFEST_COLOR = tokens.theme.light.bg;
