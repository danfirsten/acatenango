import type { ReactNode } from 'react';

/**
 * Ink and paper's button: a pill at least 48 px tall, solid ink for the primary
 * action and a 1 px outline for the rest. `compact` is 44 px, kept for the two
 * official links in the notice. A link that leaves the site carries ↗.
 */
export interface PillProps {
  children: ReactNode;
  variant?: 'primary' | 'outline';
  compact?: boolean;
  /** Renders a link when set, otherwise a button. */
  href?: string;
  /** The link leaves the site: adds ↗ after the words. */
  external?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  'aria-label'?: string;
}

export function pillClass(variant: PillProps['variant'] = 'primary', compact = false): string {
  return ['pill', variant === 'primary' ? 'pill-solid' : 'pill-line', compact && 'pill-compact', 'press']
    .filter(Boolean)
    .join(' ');
}

export default function Pill({ children, variant = 'primary', compact = false, href, external = false, onClick,
  type = 'button', 'aria-label': ariaLabel }: PillProps) {
  const className = pillClass(variant, compact);
  const body = (
    <>
      {children}
      {external && <span aria-hidden="true">↗</span>}
    </>
  );
  return href !== undefined ? (
    <a className={className} href={href} onClick={onClick} aria-label={ariaLabel}>{body}</a>
  ) : (
    <button className={className} type={type} onClick={onClick} aria-label={ariaLabel}>{body}</button>
  );
}
