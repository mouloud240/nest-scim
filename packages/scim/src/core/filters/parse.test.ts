import { describe, expect, it } from 'vitest';
import { parseScimFilter } from './parse';
import { isScimError } from '../errors/scim-error';

describe('parseScimFilter', () => {
  it('parses a comparison into the engine AST', () => {
    expect(parseScimFilter('userName eq "bob"')).toEqual({
      op: 'eq',
      attrPath: 'userName',
      compValue: 'bob',
    });
  });

  it('preserves and/or/not nesting verbatim', () => {
    const filter = parseScimFilter('userName eq "a" or not (title pr)');
    expect(filter).toEqual({
      op: 'or',
      filters: [
        { op: 'eq', attrPath: 'userName', compValue: 'a' },
        { op: 'not', filter: { op: 'pr', attrPath: 'title' } },
      ],
    });
  });

  it('keeps a value path as a group filter node', () => {
    expect(parseScimFilter('emails[type eq "work" and value co "@example.com"]')).toEqual({
      op: '[]',
      attrPath: 'emails',
      valFilter: {
        op: 'and',
        filters: [
          { op: 'eq', attrPath: 'type', compValue: 'work' },
          { op: 'co', attrPath: 'value', compValue: '@example.com' },
        ],
      },
    });
  });

  it('strips core URN prefixes from comparison paths', () => {
    const filter = parseScimFilter(
      'urn:ietf:params:scim:schemas:core:2.0:User:userName eq "bob"',
    ) as { op: string; attrPath: string };
    expect(filter.attrPath).toBe('userName');
  });

  it('strips URN prefixes inside value paths too', () => {
    const filter = parseScimFilter(
      'urn:ietf:params:scim:schemas:core:2.0:User:emails[type eq "work"]',
    ) as { op: string; attrPath: string };
    expect(filter.attrPath).toBe('emails');
  });

  it('normalizes whitespace-only input to invalidFilter', () => {
    try {
      parseScimFilter('   ');
      expect.unreachable();
    } catch (error) {
      expect(isScimError(error)).toBe(true);
      expect(error).toMatchObject({ status: 400, scimType: 'invalidFilter' });
    }
  });

  it('maps engine syntax errors to invalidFilter', () => {
    for (const bad of ['userName eq', 'userName &&', 'userName eq "a" and', '((title pr)']) {
      try {
        parseScimFilter(bad);
        expect.unreachable(bad);
      } catch (error) {
        expect(isScimError(error)).toBe(true);
        expect(error).toMatchObject({ status: 400, scimType: 'invalidFilter' });
      }
    }
  });
});
