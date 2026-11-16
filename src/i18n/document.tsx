import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import type { ReactNode } from 'react';

import ServiceWorker from '@/components/ServiceWorker';
import { siteUrl, withBase } from '@/lib/base-path';

import { getDict, LOCALE_PATH, LOCALES, type Locale } from './index';

/**
 * What both root layouts share: the fonts, the metadata and the <html> shell.
 * Each language has its own root layout (`app/(en)` and `app/es`) so that the
 * static HTML carries the right `lang` from the first byte.
 */

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

/** The absolute URL of a language's page. */
export function pageUrl(locale: Locale): string {
  return new URL(LOCALE_PATH[locale].slice(1), SITE_URL).href;
}

export function buildMetadata(locale: Locale): Metadata {
  const { meta } = getDict(locale);
  const url = pageUrl(locale);
  const og = new URL('og.png', SITE_URL).href;
  return {
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    // Next does not prefix the base path onto metadata links, so do it here.
    manifest: withBase('/manifest.webmanifest'),
    icons: { icon: withBase('/icon.svg') },
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [getDict(l).htmlLang, pageUrl(l)])),
        'x-default': pageUrl('en'),
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      siteName: 'Fuego',
      type: 'website',
      locale: meta.ogLocale,
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => getDict(l).meta.ogLocale),
      images: [{ url: og, width: 1200, height: 630, alt: meta.ogAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: [og],
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#0B1016',
};

export function Document({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={getDict(locale).htmlLang} className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
