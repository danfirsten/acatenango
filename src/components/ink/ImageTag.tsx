import type { ReactNode } from 'react';

/**
 * The image tag: a dark pill at 78% with a blur, in mono, 14 px from the
 * bottom-left of the scene or a photo (`Orbit · 16 Nov`). Its parent must be
 * positioned.
 */
export default function ImageTag({ children }: { children: ReactNode }) {
  return <span className="chip-tag">{children}</span>;
}
