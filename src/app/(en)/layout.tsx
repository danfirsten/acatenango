import type { Metadata } from 'next';

import { buildMetadata, Document } from '@/i18n/document';

import '../globals.css';

export { viewport } from '@/i18n/document';

export const metadata: Metadata = buildMetadata('en');

export default function EnglishLayout({ children }: LayoutProps<'/'>) {
  return <Document locale="en">{children}</Document>;
}
