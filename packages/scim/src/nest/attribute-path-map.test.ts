import { describe, expect, it } from 'vitest';
import { assertAttributePathMap } from './attribute-path-map';
import { ScimModuleConfigError } from './scim-config-error';
import type { ScimUserService } from './spi';
import { ScimUserAdapter } from './scim-user-adapter';

const unusedService: ScimUserService<never> = {
  findById: async () => null,
  findByUserName: async () => null,
  findByExternalId: async () => null,
  create: async (u) => u,
  update: async (u) => u,
  deleteById: async () => undefined,
  list: async () => ({ totalResults: 0, items: [] }),
};

function makeAdapter(attributePathMap: unknown): ScimUserAdapter {
  return new ScimUserAdapter({
    userService: unusedService,
    userMapper: {
      attributePathMap: attributePathMap as Record<string, string>,
      getId: () => '',
      fromScim: (scim) => scim as never,
      toScim: () => ({ userName: '' }),
    },
    basePath: '/scim/v2',
    maxResultsPerPage: 200,
  });
}

const expectConfigError = (map: unknown): void => {
  expect(() => assertAttributePathMap(map)).toThrow(ScimModuleConfigError);
};

describe('assertAttributePathMap (bootstrap contract)', () => {
  it('accepts an empty map — "no filters supported" is legal', () => {
    expect(() => assertAttributePathMap({})).not.toThrow();
  });

  it('accepts dotted SCIM keys and dotted domain values', () => {
    expect(() =>
      assertAttributePathMap({
        'emails.value': 'contacts.emails.address',
        'name.familyName': 'profile.lastName',
        userName: 'login',
      }),
    ).not.toThrow();
  });

  it('rejects non-objects, arrays, and null', () => {
    expectConfigError(null);
    expectConfigError(undefined);
    expectConfigError('userName');
    expectConfigError([]);
  });

  it('rejects non-string domain values', () => {
    expectConfigError({ userName: 42 });
  });

  it('rejects empty keys and values', () => {
    expectConfigError({ '': 'userName' });
    expectConfigError({ userName: '' });
  });

  it('rejects dot-paths with empty segments', () => {
    expectConfigError({ '.userName': 'login' });
    expectConfigError({ 'userName.': 'login' });
    expectConfigError({ 'userName..x': 'login' });
    expectConfigError({ userName: '.login' });
    expectConfigError({ userName: 'profile..login' });
  });

  it('rejects URN/extension-style keys', () => {
    expectConfigError({ 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': 'org' });
  });

  it('rejects duplicate keys that differ only by case', () => {
    expectConfigError({ userName: 'login', UserName: 'login' });
  });
});

describe('ScimUserAdapter bootstrap validation', () => {
  it('fails construction when the mapper map is malformed', () => {
    expect(() => makeAdapter({ userName: '' })).toThrow(/userMapper\.attributePathMap/);
  });

  it('constructs with a valid map', () => {
    expect(() => makeAdapter({ userName: 'login' })).not.toThrow();
  });
});
