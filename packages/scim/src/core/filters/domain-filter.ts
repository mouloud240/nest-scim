/**
 * Compiled filter — the store-side filtering contract (RFC 7644 §3.4.2.2).
 *
 * The library parses the wire filter, resolves every attrPath through the
 * mapper's `attributePathMap`, and hands the store this tree. The library
 * never evaluates rows: the store translates each node to its own dialect.
 *
 * Semantics the store MUST preserve (rfc7644.txt Table 3):
 * - comparisons are false when the attribute is unassigned/empty;
 * - `pr` is true for a non-empty/non-null value or a non-empty complex node;
 * - `[]` is true when AT LEAST ONE element satisfies the whole `itemFilter`
 *   (never two independent element matches);
 * - `not` is the logical negation of the child, including absent-attribute
 *   cases (`not` of a false comparison is true);
 * - `ne` never appears — compile desugars it to `pr AND NOT eq`;
 * - SQL-style NULL handling is the store's translation burden (see README).
 */
export type ComparisonOp = 'eq' | 'co' | 'sw' | 'ew' | 'gt' | 'lt' | 'ge' | 'le';

export interface DomainComparison<P extends string = string> {
  op: ComparisonOp;
  /** Domain dot-path from `attributePathMap` (relative to the element in `itemFilter`). */
  path: P;
  value: string | number | boolean | null;
  /** True only for string-ish attributes whose schema says `caseExact: false`. */
  ignoreCase: boolean;
}

export interface DomainPresence<P extends string = string> {
  op: 'pr';
  path: P;
}

export interface DomainValuePath<P extends string = string> {
  op: '[]';
  /** Domain path of the multi-valued container. */
  path: P;
  /** Same-element filter; paths are relative to one element. */
  itemFilter: DomainFilter<P>;
}

export interface DomainLogical<P extends string = string> {
  op: 'and' | 'or';
  filters: DomainFilter<P>[];
}

export interface DomainNot<P extends string = string> {
  op: 'not';
  filter: DomainFilter<P>;
}

export type DomainFilter<P extends string = string> =
  | DomainComparison<P>
  | DomainPresence<P>
  | DomainValuePath<P>
  | DomainLogical<P>
  | DomainNot<P>;
