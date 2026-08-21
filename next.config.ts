import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The site is a pure static export: no server, no database, nothing to run.
  // Deployable to any static host, and cacheable in full by a service worker
  // so it still renders with no signal on the mountain.
  output: 'export',
  images: {
    // Static export cannot use the default optimizing loader.
    unoptimized: true,
  },
};

export default nextConfig;
