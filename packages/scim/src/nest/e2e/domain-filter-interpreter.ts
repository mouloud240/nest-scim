/**
 * Reference store-side interpreter for {@link DomainFilter} — reference
 * material for the e2e harness and README, NOT part of the public contract.
 *
 * A real store translates the tree to its own dialect (SQL, Prisma, …).
 * This one resolves paths against plain objects so the harness can prove
 * the compiled tree carries everything a store needs.
 *
 * Semantics mirror RFC 7644 Table 3:
 * - comparisons are false for unassigned values;
 * - `pr` is non-empty/non-null (an empty string/array/object is absent);
 * - `[]` matches when ONE element satisfies the whole item filter;
 * - `ignoreCase` folds string comparisons only.
 */
import type { ComparisonOp, DomainFilter } from '../../core/filters/domain-filter';

function valueAt(row: object, path: string): unknown {
  let value: unknown = row;
  for (const segment of path.split('.')) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function fold(value: unknown, ignoreCase: boolean): unknown {
  return ignoreCase && typeof value === 'string' ? value.toLowerCase() : value;
}

function compare(actual: unknown, op: ComparisonOp, expected: unknown, ignoreCase: boolean): boolean {
  if (actual === null || actual === undefined) return false;
  const left = fold(actual, ignoreCase);
  const right = fold(expected, ignoreCase);
  const bothNumbers = typeof left === 'number' && typeof right === 'number';
  const bothStrings = typeof left === 'string' && typeof right === 'string';

  switch (op) {
    case 'eq':
      return left === right;
    case 'co':
      return bothStrings && left.includes(right);
    case 'sw':
      return bothStrings && left.startsWith(right);
    case 'ew':
      return bothStrings && left.endsWith(right);
    case 'gt':
      return (bothNumbers && left > right) || (bothStrings && left > right);
    case 'lt':
      return (bothNumbers && left < right) || (bothStrings && left < right);
    case 'ge':
      return left === right || (bothNumbers && left > right) || (bothStrings && left > right);
    case 'le':
      return left === right || (bothNumbers && left < right) || (bothStrings && left < right);
  }
}

export function testDomainFilter(row: object, filter: DomainFilter): boolean {
  switch (filter.op) {
    case 'and':
      return filter.filters.every((child) => testDomainFilter(row, child));
    case 'or':
      return filter.filters.some((child) => testDomainFilter(row, child));
    case 'not':
      return !testDomainFilter(row, filter.filter);
    case 'pr':
      return isPresent(valueAt(row, filter.path));
    case '[]': {
      const values = valueAt(row, filter.path);
      return (
        Array.isArray(values) &&
        values.some((element) => testDomainFilter(element as object, filter.itemFilter))
      );
    }
    default:
      return compare(valueAt(row, filter.path), filter.op, filter.value, filter.ignoreCase);
  }
}
