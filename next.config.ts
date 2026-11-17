import type { NextConfig } from 'next';

import { normaliseBasePath } from './src/lib/base-path';

// GitHub Pages serves this as a project site under /acatenango; the Pages
// workflow sets PAGES_BASE_PATH. Locally it is unset and the site sits at /.
const basePath = normaliseBasePath(process.env.PAGES_BASE_PATH);

const nextConfig: NextConfig = {
  // The site is a pure static export: no server, no database, nothing to run.
  // Deployable to any static host, and cacheable in full by a service worker
  // so it still renders with no signal on the mountain.
  output: 'export',
  // Each page is a folder with an index.html, so /es/ works on any static host
  // (GitHub Pages serves /acatenango/es/ from es/index.html).
  trailingSlash: true,
  // Two root layouts (one per language) leave no single layout for the 404, so
  // it is its own page: src/app/global-not-found.tsx.
  experimental: { globalNotFound: true },
  basePath,
  assetPrefix: basePath || undefined,
  // Inlined into the client bundle so fetches and the service worker can use it.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: {
    // Static export cannot use the default optimizing loader.
    unoptimized: true,
  },
};

export default nextConfig;
