import type { ReactNode } from 'react';

/**
 * A label: Geist Mono at 11 px in the muted colour. Inside the page
 * (`data-surface="app"` on the body) it keeps sentence case.
 */
export default function Label({ children, as: Tag = 'span', className }: {
  children: ReactNode;
  as?: 'span' | 'p' | 'dt' | 'div';
  className?: string;
}) {
  return <Tag className={className ? `label ${className}` : 'label'}>{children}</Tag>;
}
