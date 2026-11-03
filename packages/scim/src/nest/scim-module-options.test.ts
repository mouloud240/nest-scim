import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { SCIM_USER_MAPPER, SCIM_USER_SERVICE } from './tokens';
import { ScimModuleOptions } from './scim-module-options';
import { ScimUserMapperToken, getScimUserMapperMarker, SCIM_USER_MAPPER_MARKER } from './scim-user-mapper.decorator';

describe('DI tokens', () => {
  it('are registry symbols stable across evaluation contexts', () => {
    expect(SCIM_USER_SERVICE).toBe(Symbol.for('nest-scim.user-service'));
    expect(SCIM_USER_MAPPER).toBe(Symbol.for('nest-scim.user-mapper'));
  });

  it('expose distinct keys', () => {
    expect(SCIM_USER_SERVICE).not.toBe(SCIM_USER_MAPPER);
  });
});

describe('ScimUserMapperToken decorator', () => {
  it('marks the decorated class with a readable, Symbol.for-backed marker', () => {
    @ScimUserMapperToken()
    class ExampleMapper {}

    expect(getScimUserMapperMarker(ExampleMapper)).toBe(true);
    expect(
      Reflect.getMetadata(SCIM_USER_MAPPER_MARKER, ExampleMapper),
    ).toBe(true);
  });

  it('leaves undecorated classes unmarked', () => {
    class NotAMapper {}

    expect(getScimUserMapperMarker(NotAMapper)).toBeUndefined();
  });

  it('marker identity survives duplicated library copies', () => {
    expect(SCIM_USER_MAPPER_MARKER).toBe(
      Symbol.for('nest-scim.user-mapper-marker'),
    );
  });
});

describe('ScimModuleOptions shape', () => {
  it('accepts the full documented option set', () => {
    class UserService {}
    @ScimUserMapperToken()
    class UserMapper {}

    const options: ScimModuleOptions = {
      basePath: '/scim/v2',
      userService: UserService,
      userMapper: UserMapper,
      auth: [class Guard implements never {} as never],
      serviceProviderConfig: { filter: { maxResults: 50 } },
    };

    expect(options.basePath).toBe('/scim/v2');
    expect(options.serviceProviderConfig?.filter?.maxResults).toBe(50);
    // auth accepts a single class too — same shape check on the union.
    const single: ScimModuleOptions = {
      basePath: '',
      userService: UserService,
      userMapper: UserMapper,
      auth: class Guard {},
    };
    expect(single.basePath).toBe('');
  });
});
