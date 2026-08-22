import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';

import ServiceWorker from '@/components/ServiceWorker';

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

export const metadata: Metadata = {
  title: 'Fuego — live from the Acatenango massif',
  description:
    'A live monitor for Volcán de Fuego, Guatemala, rendered from real elevation data.',
  manifest: '/manifest.webmanifest',
  themeColor: '#0B1016',
  icons: { icon: '/icon.svg' },
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
