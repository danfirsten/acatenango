import type { Metadata } from 'next';

import { buildMetadata, Document } from '@/i18n/document';

import '../globals.css';

export { viewport } from '@/i18n/document';

export const metadata: Metadata = buildMetadata('es');

export default function SpanishLayout({ children }: LayoutProps<'/es'>) {
  return <Document locale="es">{children}</Document>;
}
