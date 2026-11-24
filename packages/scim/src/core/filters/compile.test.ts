import { describe, expect, it } from 'vitest';
import { isScimError } from '../errors/scim-error';
import { compileFilter } from './compile';
import { parseScimFilter } from './parse';
import type { ScimFilterExpression } from './parse';

const MAP = {
  userName: 'userName',
  userType: 'role',
  displayName: 'display',
  'name.familyName': 'profile.lastName',
  emails: 'emails',
  'emails.value': 'emails.address',
  'emails.type': 'emails.kind',
  active: 'active',
  age: 'age',
  id: 'uuid',
} as const;

const compile = (raw: string, map: Readonly<Record<string, string>> = MAP) =>
  compileFilter(parseScimFilter(raw), map);

function expectInvalidFilter(run: () => unknown): void {
  try {
    run();
    expect.unreachable();
  } catch (error) {
    expect(isScimError(error)).toBe(true);
    expect(error).toMatchObject({ status: 400, scimType: 'invalidFilter' });
  }
}

describe('compileFilter — SCIM AST → DomainFilter', () => {
  it('resolves a simple comparison through the map, case-insensitively', () => {
    expect(compile('UserName eq "bob"')).toEqual({
      op: 'eq',
      path: 'userName',
      value: 'bob',
      ignoreCase: true,
    });
  });

  it('resolves dotted sub-attribute paths', () => {
    expect(compile('name.familyName sw "Jones"')).toEqual({
      op: 'sw',
      path: 'profile.lastName',
      value: 'Jones',
      ignoreCase: true,
    });
  });

  it('keeps non-string literals strict', () => {
    expect(compile('active eq true')).toEqual({
      op: 'eq',
      path: 'active',
      value: true,
      ignoreCase: false,
    });
    expect(compile('displayName eq null')).toEqual({
      op: 'eq',
      path: 'display',
      value: null,
      ignoreCase: false,
    });
  });

  it('preserves and/or/not nesting', () => {
    expect(compile('userType eq "Employee" or not (displayName pr)')).toEqual({
      op: 'or',
      filters: [
        { op: 'eq', path: 'role', value: 'Employee', ignoreCase: true },
        { op: 'not', filter: { op: 'pr', path: 'display' } },
      ],
    });
  });

  it('compiles value paths with relative item paths (same-element unit)', () => {
    expect(compile('emails[type eq "work" and value co "@example.com"]')).toEqual({
      op: '[]',
      path: 'emails',
      itemFilter: {
        op: 'and',
        filters: [
          { op: 'eq', path: 'kind', value: 'work', ignoreCase: true },
          { op: 'co', path: 'address', value: '@example.com', ignoreCase: true },
        ],
      },
    });
  });

  it('wraps a negated value path as not([])', () => {
    expect(compile('not emails[type eq "work"]')).toEqual({
      op: 'not',
      filter: {
        op: '[]',
        path: 'emails',
        itemFilter: { op: 'eq', path: 'kind', value: 'work', ignoreCase: true },
      },
    });
  });

  it('desugars ne into pr AND NOT eq', () => {
    expect(compile('userType ne "EMPLOYEE"')).toEqual({
      op: 'and',
      filters: [
        { op: 'pr', path: 'role' },
        {
          op: 'not',
          filter: { op: 'eq', path: 'role', value: 'EMPLOYEE', ignoreCase: true },
        },
      ],
    });
  });

  it('compiles presence on complex and dotted paths', () => {
    expect(compile('emails pr')).toEqual({ op: 'pr', path: 'emails' });
    expect(compile('name.familyName pr')).toEqual({ op: 'pr', path: 'profile.lastName' });
  });

  it('normalizes URN-prefixed paths through the parser', () => {
    expect(
      compile('urn:ietf:params:scim:schemas:core:2.0:User:userName eq "x"'),
    ).toEqual({ op: 'eq', path: 'userName', value: 'x', ignoreCase: true });
  });

  it('rejects unmapped attributes', () => {
    expectInvalidFilter(() => compile('nickName eq "x"'));
  });

  it('rejects unmapped inner value-path attributes', () => {
    expectInvalidFilter(() => compile('emails[foo eq "x"]'));
  });

  it('requires the container itself to be mapped for value paths', () => {
    expectInvalidFilter(() =>
      compile('emails[type eq "work"]', {
        'emails.type': 'emails.kind',
        'emails.value': 'emails.address',
      }),
    );
  });

  it('rejects sub-paths that do not sit under the mapped container', () => {
    expectInvalidFilter(() =>
      compile('emails[type eq "work"]', {
        emails: 'contacts.emails',
        'emails.type': 'labels.kind',
      }),
    );
  });

  it('rejects bare comparisons on complex attributes', () => {
    expectInvalidFilter(() => compile('emails eq "x"'));
    expectInvalidFilter(() => compile('name eq "x"'));
  });

  it('rejects value paths on non-multi-valued attributes', () => {
    expectInvalidFilter(() => compile('name[familyName eq "x"]'));
    expectInvalidFilter(() => compile('userName[type eq "x"]'));
  });

  it('rejects nested value paths even if constructed directly', () => {
    const nested: ScimFilterExpression = {
      op: '[]',
      attrPath: 'emails',
      valFilter: {
        op: '[]',
        attrPath: 'value',
        valFilter: { op: 'eq', attrPath: 'type', compValue: 'x' },
      },
    };
    expectInvalidFilter(() => compileFilter(nested, MAP));
  });

  it('rejects range operators on boolean/binary attributes', () => {
    expectInvalidFilter(() => compile('active gt true'));
  });

  it('allows range comparisons on unknown/numeric paths', () => {
    expect(compile('age gt 7')).toEqual({
      op: 'gt',
      path: 'age',
      value: 7,
      ignoreCase: false,
    });
  });

  it('rejects every filter when the map is empty', () => {
    expectInvalidFilter(() => compile('userName eq "x"', {}));
  });
});
