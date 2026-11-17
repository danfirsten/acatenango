/**
 * The five marks from ink and paper, used across Fuego for the state of a value
 * (docs/design.md, "Marks: missing is never zero"). Always shown with words
 * beside them, so a mark on its own is hidden from screen readers unless it is
 * given a label.
 */
export type MarkKind = 'solid' | 'ring' | 'hatched' | 'dotted' | 'half';

/** The vendored class for each mark, in the system's own numbering. */
export const MARK_CLASS: Record<MarkKind, string> = {
  solid: 'mark-1',
  ring: 'mark-2',
  half: 'mark-3',
  hatched: 'mark-4',
  dotted: 'mark-5',
};

export default function Mark({ kind, label }: { kind: MarkKind; label?: string }) {
  return (
    <span
      className={`mark ${MARK_CLASS[kind]}`}
      data-mark={kind}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
