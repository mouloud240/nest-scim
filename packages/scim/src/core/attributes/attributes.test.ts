import { describe, expect, it, expectTypeOf } from 'vitest';
import {
  projectScimResource,
  selectAttributePath,
  splitAttributePath,
} from './attributes';
import { invalidFilter, invalidValue } from '../errors/factories';

const full = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
  id: '2819c223',
  userName: 'bjensen',
  name: { givenName: 'Barbara', familyName: 'Jensen' },
  emails: [{ value: 'b@x.com', type: 'work', primary: true }, { value: 'p@x.com', type: 'home' }],
  meta: { resourceType: 'User', location: '/Users/2819c223' },
};

describe('splitAttributePath (RFC 7644 §3.10)', () => {
  it('splits dotted paths', () => {
    expect(splitAttributePath('name.givenName')).toEqual(['name', 'givenName']);
  });

  it('strips the core User URN prefix (case-insensitively)', () => {
    expect(splitAttributePath('URN:IETF:params:scim:schemas:core:2.0:User:userName')).toEqual(['userName']);
  });

  it('reduces unknown extension URNs to the trailing handle', () => {
    expect(splitAttributePath('urn:example:2.0:hr:age')).toEqual(['age']);
  });

  it('rejects value-filter notation as invalidFilter', () => {
    expect(() => splitAttributePath('emails[type eq "work"].value')).toThrow(invalidFilter().detail === undefined ? Error : Error);
    try {
      splitAttributePath('emails[primary eq true].value');
      expect.unreachable();
    } catch (error) {
      expect((error as { status: number }).status).toBe(400);
      expect((error as { scimType?: string }).scimType).toBe('invalidFilter');
    }
  });

  it('throws on empty segments', () => {
    expect(() => splitAttributePath('   ')).toThrow();
  });
});

describe('selectAttributePath', () => {
  it('reads dotted paths and matches keys case-insensitively', () => {
    expect(selectAttributePath(full, ['NAME', 'givenname'])).toBe('Barbara');
    expect(selectAttributePath(full, ['userName'])).toBe('bjensen');
  });

  it('maps dotted selections across arrays without flattening', () => {
    expect(selectAttributePath(full, ['emails', 'value'])).toEqual(['b@x.com', 'p@x.com']);
  });

  it('returns undefined for absent paths', () => {
    expect(selectAttributePath(full, ['nickname'])).toBeUndefined();
  });
});

describe('projectScimResource (RFC 7644 §3.9)', () => {
  it('attributes mode: keeps schemas + id + requested only (§3.9 example)', () => {
    const projected = projectScimResource(full, { attributes: ['userName'] });

    expect(projected).toEqual({
      schemas: full.schemas,
      id: full.id,
      userName: 'bjensen',
    });
  });

  it('attributes mode supports dotted sub-attribute requests', () => {
    const projected = projectScimResource(full, { attributes: ['name.givenName', 'emails.value'] });

    expect(projected).toEqual({
      schemas: full.schemas,
      id: full.id,
      name: { givenName: 'Barbara' },
      emails: [{ value: 'b@x.com' }, { value: 'p@x.com' }],
    });
  });

  it('attributes mode silently skips unknown names', () => {
    const projected = projectScimResource(full, { attributes: ['userName', 'fancy'] });

    expect(projected).toEqual({
      schemas: full.schemas,
      id: full.id,
      userName: 'bjensen',
    });
  });

  it('excludedAttributes mode removes requested paths but keeps minimum set', () => {
    const reduced = projectScimResource(full, { excludedAttributes: ['name.givenName'] });

    expect(reduced).toEqual({
      schemas: full.schemas,
      id: full.id,
      userName: 'bjensen',
      name: { familyName: 'Jensen' },
      emails: full.emails,
      meta: full.meta,
    });
  });

  it('the minimum set cannot be excluded', () => {
    const reduced = projectScimResource(full, { excludedAttributes: ['id', 'Schemas'] });

    expect(reduced).toHaveProperty('id');
    expect(reduced).toHaveProperty('schemas');
  });

  it('rejects mutual exclusivity with invalidValue', () => {
    expect(() =>
      projectScimResource(full, { attributes: ['userName'], excludedAttributes: ['name'] }),
    ).toThrow(invalidValue().detail === undefined ? Error : Error);
    try {
      projectScimResource(full, { attributes: ['userName'], excludedAttributes: ['name'] });
      expect.unreachable();
    } catch (error) {
      expect((error as { status: number }).status).toBe(400);
    }
  });

  it('returns the object untouched without any selection', () => {
    const same = projectScimResource(full, {});
    expect(same).toBe(full);
  });

  it('type surface: projection is generic over the resource', () => {
    expectTypeOf(projectScimResource(full, {})).toEqualTypeOf(full);
  });
});
