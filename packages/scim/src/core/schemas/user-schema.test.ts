import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCIM_USER_SCHEMA_DESCRIPTOR } from './user-schema';
import type { ScimSchemaDescriptor } from './schema-types';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'user-schema.json'), 'utf8'),
) as ScimSchemaDescriptor;

describe('SCIM_USER_SCHEMA_DESCRIPTOR fidelity (RFC 7643 §8.7.1)', () => {
  it('is identical to the RFC-verbatim fixture', () => {
    // Fixture extracted mechanically from docs/rfc/rfc7643.txt §8.7.1;
    // any mismatch means the shipped descriptor drifted from the RFC.
    expect(SCIM_USER_SCHEMA_DESCRIPTOR).toEqual(fixture);
  });

  it('covers all 21 §4.1 User attributes in RFC order', () => {
    expect(fixture.attributes).toHaveLength(21);
    expect(fixture.attributes.map((a) => a.name)).toEqual([
      'userName',
      'name',
      'displayName',
      'nickName',
      'profileUrl',
      'title',
      'userType',
      'preferredLanguage',
      'locale',
      'timezone',
      'active',
      'password',
      'emails',
      'phoneNumbers',
      'ims',
      'photos',
      'addresses',
      'groups',
      'entitlements',
      'roles',
      'x509Certificates',
    ]);
  });

  it('marks userName required with server uniqueness and password writeOnly', () => {
    const userName = fixture.attributes.find((a) => a.name === 'userName');
    const password = fixture.attributes.find((a) => a.name === 'password');

    expect(userName?.required).toBe(true);
    expect(userName?.uniqueness).toBe('server');
    expect(password?.mutability).toBe('writeOnly');
    expect(password?.returned).toBe('never');
  });

  it('declares groups readOnly with direct|indirect canonicalValues', () => {
    const groups = fixture.attributes.find((a) => a.name === 'groups');

    expect(groups?.mutability).toBe('readOnly');
    expect(groups?.subAttributes?.find((s) => s.name === 'type')?.canonicalValues).toEqual(['direct', 'indirect']);
  });
});
