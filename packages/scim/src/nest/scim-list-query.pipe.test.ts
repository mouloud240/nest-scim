/**
 * Pipe tests — thin, on purpose. The pipe adds no parsing logic: its job
 * is delegation (single source of truth lives in
 * `ScimUserAdapter.parseListQuery`, whose interpretation rules are
 * exhaustively tested in `scim-user-adapter.test.ts`). Here we only prove
 * the delegation contract and that parse-time ScimErrors pass through.
 */
import { describe, expect, it } from 'vitest';
import type { ScimUserService } from './spi';
import { ParsedListQuery, ScimUserAdapter } from './scim-user-adapter';
import { ScimListQueryPipe } from './scim-list-query.pipe';

/** SPI stand-in — never called (parsing touches options only). */
const unusedService: ScimUserService<never> = {
  findById: async () => null,
  findByUserName: async () => null,
  findByExternalId: async () => null,
  create: async (u) => u,
  update: async (u) => u,
  deleteById: async () => undefined,
  list: async () => ({ totalResults: 0, items: [] }),
};

const adapter = new ScimUserAdapter({
  userService: unusedService,
  userMapper: {
    getId: () => '',
    fromScim: (scim) => scim as never,
    toScim: () => ({ userName: '' }),
  },
  basePath: '/scim/v2',
  maxResultsPerPage: 200,
});

const pipe = new ScimListQueryPipe(adapter);

describe('ScimListQueryPipe (delegating typed boundary)', () => {
  it('hands the parsed, typed shape back for a raw query', () => {
    const parsed: ParsedListQuery = pipe.transform({ startIndex: '3', count: '2', attributes: 'userName' });

    expect(parsed).toEqual({
      startIndex: 3,
      count: 2,
      attributes: ['userName'],
      excludedAttributes: undefined,
      filter: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      explicitStartIndex: true,
      explicitCount: true,
    });
  });

  it('normalizes the unspecified query exactly like the adapter does', () => {
    expect(pipe.transform(undefined)).toMatchObject({
      startIndex: 1,
      count: 200,
      explicitStartIndex: false,
      explicitCount: false,
    });
  });

  it('passes parse-time ScimErrors through untouched (§3.12 filter later catches them)', () => {
    expect(() => pipe.transform({ filter: 'userName pr' })).toThrow(/not yet enabled/);
    expect(() => pipe.transform({ sortBy: 'userName' })).toThrow(/Sorting/);
  });
});
