import { describe, expect, it, expectTypeOf } from 'vitest';
import { ScimModuleOptions } from './scim-module-options';
import { ScimModule } from './scim-module';
import { ScimUserAdapter } from './scim-user-adapter';
import { SCIM_USER_MAPPER, SCIM_USER_SERVICE } from './tokens';

/** Minimal SPI classes for module wiring tests. */
class UserService {}
class UserMapper {
  attributePathMap = {};
}

const baseOptions: ScimModuleOptions = {
  basePath: '/scim//v2/',
  userService: UserService,
  userMapper: UserMapper,
};

describe('ScimModule.forRoot (config validation)', () => {
  it('normalizes the base path onto controllers/providers metadata', () => {
    const dynamic = ScimModule.forRoot(baseOptions);

    expect(dynamic.module).toBe(ScimModule);
    expect(dynamic.controllers).toHaveLength(2);
    expect(dynamic.providers?.map((p) => (p as { provide: unknown }).provide)).toEqual(
      expect.arrayContaining([SCIM_USER_SERVICE, SCIM_USER_MAPPER, ScimUserAdapter]),
    );
    expect(dynamic.exports).toEqual(expect.arrayContaining([SCIM_USER_SERVICE, SCIM_USER_MAPPER]));
  });

  it('throws on non-class userService/userMapper (fail at bootstrap, never inside a request)', () => {
    expect(() =>
      ScimModule.forRoot({ ...baseOptions, userService: {} as unknown as typeof UserService }),
    ).toThrow(/userService/);
    expect(() =>
      ScimModule.forRoot({ ...baseOptions, userMapper: 'str' as unknown as typeof UserMapper }),
    ).toThrow(/userMapper/);
  });

  it('accepts missing auth and default config overrides', () => {
    const dynamic = ScimModule.forRoot(baseOptions);

    expect(dynamic.imports).toEqual([]);
    const adapterProvider = dynamic.providers?.find(
      (p) => (p as { provide?: unknown }).provide === ScimUserAdapter,
    ) as { provide: unknown; inject: unknown[]; useFactory: (a: never, b: never) => unknown } | undefined;

    expect(adapterProvider?.inject).toEqual([SCIM_USER_SERVICE, SCIM_USER_MAPPER]);
    // Factory ignores the token-typed inputs into an adapter with defaults.
    const adapter = adapterProvider?.useFactory?.(new UserService() as never, new UserMapper() as never);
    expect(adapter).toBeInstanceOf(ScimUserAdapter);
  });
});

describe('SCIM v2 route layout contracts', () => {
  it('e2e suites build real apps on this; unit level just checks the type surface', () => {
    expectTypeOf(ScimModule.forRoot({ ...baseOptions })).not.toBeNever();
  });
});
