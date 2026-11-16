import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';

import ServiceWorker from '@/components/ServiceWorker';
import { siteUrl, withBase } from '@/lib/base-path';

import './globals.css';

const barlow = Barlow({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

/**
 * Where the site is served; the social card needs absolute URLs. Always ends in
 * a slash, so 'og.png' resolves inside the base path, not at the host root.
 */
const SITE_URL = siteUrl(process.env.SITE_URL, 'https://danfirsten.github.io/acatenango/');
const TITLE = 'Fuego: live from the Acatenango massif';
const DESCRIPTION =
  'An unofficial archive of Volcán de Fuego, Guatemala, rendered from real elevation data.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // Next does not prefix the base path onto metadata links, so do it here.
  manifest: withBase('/manifest.webmanifest'),
  icons: { icon: withBase('/icon.svg') },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Fuego',
    type: 'website',
    images: [{ url: new URL('og.png', SITE_URL).href, width: 1200, height: 630, alt: 'Fuego erupting beside Acatenango' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [new URL('og.png', SITE_URL).href],
  },
};

export const viewport: Viewport = {
  themeColor: '#0B1016',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
