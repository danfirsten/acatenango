/**
 * The path the site is served under.
 *
 * Locally and on a root host it is empty. On GitHub Pages the site is a project
 * site at /acatenango, so `.github/workflows/pages.yml` builds with
 * PAGES_BASE_PATH=/acatenango. Next prefixes its own pages and bundles; every
 * other absolute path (terrain, service worker) goes through `withBase`.
 */

/** '' for the root, otherwise '/a/b' with one leading slash and no trailing one. */
export function normaliseBasePath(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

/** Inlined at build time by `next.config.ts` (`env`), and read as-is by scripts. */
export const BASE_PATH = normaliseBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

/** Prefixes a root-absolute path ('/terrain/massif.png') with the base path. */
export function withBase(p: string, base: string = BASE_PATH): string {
  if (!p.startsWith('/')) throw new Error(`withBase expects a root-absolute path, got ${p}`);
  return `${base}${p}`;
}

/**
 * The site's public URL with exactly one trailing slash, so relative URLs such
 * as 'og.png' resolve inside the base path rather than at the host root.
 */
export function siteUrl(raw: string | undefined, fallback: string): string {
  const url = (raw ?? '').trim() || fallback;
  return url.endsWith('/') ? url : `${url}/`;
}
