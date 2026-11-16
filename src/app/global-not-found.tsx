import type { Metadata } from 'next';

import { Document } from '@/i18n/document';
import { withBase } from '@/lib/base-path';

import './globals.css';

export const metadata: Metadata = {
  title: 'Fuego: page not found / página no encontrada',
};

/**
 * The 404 for any address that is not a page. Each language has its own root
 * layout, so there is no single layout to put a 404 in; this one is in both
 * languages and links to both pages.
 */
export default function GlobalNotFound() {
  return (
    <Document locale="en">
      <main className="lost">
        <h1>Page not found</h1>
        <p>No page of the record is at this address.</p>
        <p><a href={withBase('/')}>Go to Fuego</a></p>
        <p lang="es" className="lost-h">Página no encontrada</p>
        <p lang="es">No hay ninguna página del registro en esta dirección.</p>
        <p lang="es"><a href={withBase('/es/')}>Ir a Fuego en español</a></p>
      </main>
    </Document>
  );
}
