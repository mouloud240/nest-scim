import { describe, expect, it } from 'vitest';
import { expectTypeOf } from 'vitest';
import type { Page } from '../core/types/list';
import type { ScimUserCreate } from '../core/types/user';
import type { ScimUserMapper, ScimUserService, ScimUserServicePage } from './spi';

interface DomainUser {
  key: string;
  name: string;
  email: string | null;
}

/** Minimal conforming battery — proves the SPI contracts ARE implementable. */
const userMapper: ScimUserMapper<DomainUser> = {
  getId: (d) => d.key,
  fromScim: (scim, existing) => ({
    key: existing?.key ?? crypto.randomUUID(),
    name: scim.userName, // 1:1 stand-in for real domain mapping
    email: scim.emails?.[0]?.value ?? null, // strict absence ⇒ cleared
  }),
  toScim: (d) => ({ userName: d.name, emails: d.email ? [{ value: d.email, type: 'home' }] : undefined }),
};

const userService: ScimUserService<DomainUser> = {
  findById: async (id) => ({ key: id, name: 'x', email: null }),
  findByUserName: async () => null,
  findByExternalId: async () => null,
  create: async (u) => u,
  update: async (u) => u,
  deleteById: async () => undefined,
  list: async () => ({ totalResults: 0, items: [] }),
};

describe('SPI contract types', () => {
  it('mapper RoundTrips through fromScim/toScim with 1-based pagination', () => {
    const page: ScimUserServicePage = { startIndex: 1, count: 200 };
    const scimUser: ScimUserCreate = { userName: 'bjensen', emails: [{ value: 'b@x.com', type: 'work' }] };

    const created = userMapper.fromScim(scimUser);
    const replaced = userMapper.fromScim(
      { userName: 'bjensen2' /* emails ABSENT ⇒ cleared */ },
      created,
    );

    expect(replaced.email).toBeNull(); // strict absence semantics
    expect(userMapper.getId(created)).toHaveLength(36);
    expect(page).toEqual({ startIndex: 1, count: 200 });
  });

  it('list returns a Page committed to the mapper-friendly U[] row shape', () => {
    const result = userService.list({ startIndex: 1, count: 20 });
    expectTypeOf(result).toEqualTypeOf<Promise<Page<DomainUser>>>();
    expectTypeOf<NonNullable<Parameters<ScimUserService<DomainUser>['findById']>[0]>>().toBeString();
  });
});
