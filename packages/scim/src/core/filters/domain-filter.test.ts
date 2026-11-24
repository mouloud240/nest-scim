import { describe, expect, expectTypeOf, it } from 'vitest';
import type { DomainFilter } from './domain-filter';

/** Domain paths declared by a mapper's `attributePathMap`. */
type Path = 'role' | 'emails' | 'emails.kind';

describe('DomainFilter contract type', () => {
  it('narrows the union by op', () => {
    const filter: DomainFilter = {
      op: '[]',
      path: 'emails',
      itemFilter: { op: 'eq', path: 'kind', value: 'work', ignoreCase: true },
    };

    if (filter.op !== '[]') expect.unreachable();
    expectTypeOf(filter.itemFilter).toEqualTypeOf<DomainFilter>();
    expectTypeOf(filter.path).toEqualTypeOf<string>();
  });

  it('narrows paths to the declared domain values', () => {
    const comparison: DomainFilter<Path> = {
      op: 'eq',
      path: 'role',
      value: 'Employee',
      ignoreCase: true,
    };
    expect(comparison.path).toBe('role');

    const valuePath: DomainFilter<Path> = {
      op: '[]',
      path: 'emails',
      itemFilter: { op: 'eq', path: 'emails.kind', value: 'work', ignoreCase: true },
    };
    expect(valuePath.op).toBe('[]');

    // @ts-expect-error — path must be a value of the map, not a SCIM name
    const scimName: DomainFilter<Path> = { op: 'eq', path: 'userName', value: 'x', ignoreCase: true };
    expect(scimName).toBeDefined();
  });

  it('is exhaustively switchable', () => {
    const describeNode = (filter: DomainFilter<Path>): string => {
      switch (filter.op) {
        case 'and':
        case 'or':
          return filter.op;
        case 'not':
          return 'not';
        case 'pr':
          return 'pr';
        case '[]':
          return 'some';
        default:
          return filter.op;
      }
    };

    const sample: DomainFilter<Path> = {
      op: 'and',
      filters: [
        { op: 'pr', path: 'emails' },
        { op: 'not', filter: { op: '[]', path: 'emails', itemFilter: { op: 'pr', path: 'emails.kind' } } },
      ],
    };
    expect(describeNode(sample)).toBe('and');
  });
});
