import { Fragment, type ReactNode } from 'react';

/**
 * Fills `{name}` placeholders in a dictionary string with elements, so a
 * sentence with a link in it is still one translatable string and each
 * language can put the link where its grammar wants it.
 */
export function rich(template: string, parts: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((piece, i) => {
    const m = /^\{(\w+)\}$/.exec(piece);
    return <Fragment key={i}>{m && m[1] in parts ? parts[m[1]] : piece}</Fragment>;
  });
}
