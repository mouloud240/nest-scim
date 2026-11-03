import { describe, expect, it } from 'vitest';
import { ScimError } from '../core/errors/scim-error';
import { Page } from '../core/types/list';
import { SCIM_USER_SCHEMA, ScimUserCreate } from '../core/types/user';
import { ScimUserMapper, ScimUserService } from './spi';
import { ScimUserAdapter } from './scim-user-adapter';

/* ── In-memory SPI stand-in ──────────────────────────────────────────── */

interface Row {
  id: string;
  userName: string;
  email: string | null;
  createdAt: Date;
}

const CREATED_AT = new Date('2026-01-01T00:00:00Z');

function makeMemorySuite(rows: Row[] = []) {
  const store = { rows, created: 0, updated: 0, deleted: 0 };
  const service: ScimUserService<Row> = {
    findById: async (id) => store.rows.find((r) => r.id === id) ?? null,
    findByUserName: async (userName) => store.rows.find((r) => r.userName === userName) ?? null,
    findByExternalId: async () => null,
    create: async (row) => {
      store.created += 1;
      return row;
    },
    update: async (row) => {
      store.updated += 1;
      return row;
    },
    deleteById: async (id) => {
      store.deleted += 1;
      store.rows = store.rows.filter((r) => r.id !== id);
    },
    list: async ({ startIndex, count }) => {
      const offset = startIndex - 1;
      return { items: store.rows.slice(offset, offset + count), totalResults: store.rows.length } satisfies Page<Row>;
    },
  };
  const mapper: ScimUserMapper<Row> = {
    getId: (r) => r.id,
    fromScim: (scim, existing) => ({
      id: existing?.id ?? `new-${store.created + 1}`,
      userName: scim.userName,
      email: scim.emails?.[0]?.value ?? null, // strict absence ⇒ cleared
      createdAt: existing?.createdAt ?? CREATED_AT,
    }),
    toScim: (r) => ({
      userName: r.userName,
      active: true,
      emails: r.email ? [{ value: r.email, type: 'work' }] : undefined,
    }),
    getMeta: (r) => ({ created: r.createdAt, lastModified: r.createdAt }),
  };
  const adapter = new ScimUserAdapter<Row>({
    userService: service,
    userMapper: mapper,
    basePath: '/scim/v2',
    maxResultsPerPage: 200,
  });
  return { adapter, store, mapper, service };
}

const bjensen: Row = { id: '2819c223', userName: 'bjensen', email: 'b@x.com', createdAt: CREATED_AT };

function createPayload(overrides: Partial<ScimUserCreate> = {}) {
  return {
    schemas: [SCIM_USER_SCHEMA],
    userName: 'newuser',
    emails: [{ value: 'n@x.com', type: 'work' }],
    ...overrides,
  };
}

describe('create flow (RFC 7644 §3.3)', () => {
  it('creates, maps through the mapper, adds commons + Location', async () => {
    const { adapter } = makeMemorySuite([]);
    const result = await adapter.create(createPayload());

    expect(result.resource).toMatchObject({
      id: 'new-1',
      userName: 'newuser',
      schemas: [SCIM_USER_SCHEMA],
    });
    expect(result.resource.meta).toEqual({
      resourceType: 'User',
      location: '/scim/v2/Users/new-1',
      created: '2026-01-01T00:00:00Z',
      lastModified: '2026-01-01T00:00:00Z',
    });
    expect(result.location).toBe('/scim/v2/Users/new-1');
  });

  it('409 uniqueness on duplicate userName (§3.3 lines 623–627)', async () => {
    const { adapter } = makeMemorySuite([bjensen]);

    await expect(adapter.create(createPayload({ userName: 'bjensen' }))).rejects.toMatchObject({
      status: 409,
      scimType: 'uniqueness',
    });
  });

  it('400 invalidValue when userName is missing (required, §4.1.1)', async () => {
    const { adapter } = makeMemorySuite([]);

    const { userName: _u, ...withoutUserName } = createPayload();
    await expect(adapter.create({ schemas: [SCIM_USER_SCHEMA], ...withoutUserName })).rejects.toMatchObject({
      status: 400,
      scimType: 'invalidValue',
    });
  });

  it('400 invalidSyntax when schemas does not name the core User', async () => {
    const { adapter } = makeMemorySuite([]);

    await expect(adapter.create({ schemas: ['urn:other'], userName: 'x' })).rejects.toMatchObject({
      status: 400,
      scimType: 'invalidSyntax',
    });
  });

  it('externalId uniqueness is NOT enforced by the adapter (RFC 7643 §3.1: client-controlled)', async () => {
    const { adapter } = makeMemorySuite([{ ...bjensen, id: 'row-2' }]);

    const result = await adapter.create(createPayload({ externalId: 'same-ext' }));
    expect(result.resource.id).toBe('new-1');
  });
});

describe('detail flow (RFC 7644 §3.4.1)', () => {
  it('returns commons + embedded result for an existing id', async () => {
    const { adapter } = makeMemorySuite([bjensen]);
    const result = await adapter.detail('2819c223');

    expect(result.resource.id).toBe('2819c223');
    expect(result.resource.userName).toBe('bjensen');
    expect(result.resource.meta?.location).toBe('/scim/v2/Users/2819c223');
  });

  it('404 (no scimType) for a missing id', async () => {
    const { adapter } = makeMemorySuite([]);
    await expect(adapter.detail('ghost')).rejects.toMatchObject({ status: 404 });
  });

  it('supports the §3.9 attributes projection on detail', async () => {
    const { adapter } = makeMemorySuite([bjensen]);
    const result = await adapter.detail('2819c223', { attributes: ['userName'] });

    expect(result.resource).toEqual({
      schemas: [SCIM_USER_SCHEMA],
      id: '2819c223',
      userName: 'bjensen',
    });
  });
});

describe('replace flow (RFC 7644 §3.5.1)', () => {
  it('replaces with existing as fromScim context, returns 200-style full resource', async () => {
    const { adapter } = makeMemorySuite([bjensen]);
    const result = await adapter.replace('2819c223', createPayload({ userName: 'bjensen', emails: [] }));

    expect(result.resource.id).toBe('2819c223');
    expect(result.resource.emails).toBeUndefined(); // empty [] clears per §3.3/§3.5.1
  });

  it('404 when PUT targets a missing id (MUST NOT create)', async () => {
    const { adapter } = makeMemorySuite([]);
    await expect(adapter.replace('ghost', createPayload())).rejects.toMatchObject({ status: 404 });
  });

  it('409 when PUT moves userName to an existing user', async () => {
    const { adapter, store } = makeMemorySuite([bjensen]);
    store.rows.push({ ...bjensen, id: 'row-b', userName: 'babs' });

    await expect(adapter.replace('row-b', { schemas: [SCIM_USER_SCHEMA], userName: 'bjensen' })).rejects.toMatchObject({
      status: 409,
      scimType: 'uniqueness',
    });
  });

  it('PUT with an unchanged userName does NOT self-409', async () => {
    const { adapter } = makeMemorySuite([bjensen]);
    const result = await adapter.replace('2819c223', { schemas: [SCIM_USER_SCHEMA], userName: 'bjensen', emails: [] });
    expect(result.resource.userName).toBe('bjensen'); // cleared emails, kept identity
  });
});

describe('delete flow (RFC 7644 §3.5.3)', () => {
  it('deletes after existence check', async () => {
    const { adapter, store } = makeMemorySuite([bjensen]);

    await adapter.deleteResource('2819c223');
    expect(store.deleted).toBe(1);
    expect(store.rows).toHaveLength(0);
  });

  it('404 for missing id before deletion', async () => {
    const { adapter, store } = makeMemorySuite([bjensen]);

    await expect(adapter.deleteResource('ghost')).rejects.toMatchObject({ status: 404 });
    expect(store.deleted).toBe(0);
  });
});

describe('list flow (RFC 7644 §3.4.2 + §3.4.2.4)', () => {
  function row(n: number): Row {
    return { id: `id-${n}`, userName: `user${n}`, email: null, createdAt: CREATED_AT };
  }

  function suiteWith(...rows: Row[]) {
    return makeMemorySuite(rows);
  }

  it('serves 1-based pages with RFC envelope keys', async () => {
    const { adapter } = suiteWith(row(1), row(2), row(3), row(4), row(5));
    const body = await adapter.list({ startIndex: '2', count: '2' });

    expect(body.startIndex).toBe(2);
    expect(body.itemsPerPage).toBe(2);
    expect(body.totalResults).toBe(5);
    expect(body.Resources?.map((r) => r.userName)).toEqual(['user2', 'user3']);
    expect(body.Resources?.[0]).toMatchObject({ id: 'id-2', active: true });
  });

  it('startIndex defaults to 1 and interprets <1 as 1 (Table 6)', async () => {
    const { adapter } = suiteWith(row(1), row(2));
    const negative = await adapter.list({ startIndex: '-3', count: '1' });
    const garbage = await adapter.list({ startIndex: 'abc', count: '1' });

    expect(negative.startIndex).toBe(1);
    expect(negative.Resources?.[0].userName).toBe('user1');
    expect(garbage.startIndex).toBe(1);
  });

  it('count defaults to the provider maximum and clamps to it', async () => {
    const { adapter } = suiteWith(...Array.from({ length: 250 }, (_, i) => row(i + 1)));

    const body = await adapter.list({});
    expect(body.totalResults).toBe(250);
    expect(body.itemsPerPage).toBe(200); // maxResultsPerPage default, §3.4.2.4

    const body2 = await adapter.list({ count: '999999' });
    expect(body2.itemsPerPage).toBe(200); // clamped

    const body3 = await adapter.list({ count: '10' });
    expect(body3.itemsPerPage).toBe(10);
  });

  it('negative count is interpreted as 0 (Table 6)', async () => {
    const { adapter } = suiteWith(row(1));
    const body = await adapter.list({ count: '-2' });

    expect(body.itemsPerPage).toBe(0);
    expect(body.totalResults).toBe(1);
    expect(body.Resources).toEqual([]);
  });

  it('unspecified pagination + exact-fit totals stays an unpaginated envelope', async () => {
    const { adapter } = suiteWith(row(1));
    const body = await adapter.list({});

    expect(body).toEqual({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 1,
      Resources: [expect.objectContaining({ userName: 'user1', id: 'id-1' })],
    });
    expect('startIndex' in body).toBe(false);
  });

  it('400 invalidFilter while filters are unimplemented (M2 gate)', async () => {
    const { adapter } = suiteWith();
    await expect(adapter.list({ filter: 'userName pr' })).rejects.toMatchObject({
      status: 400,
      scimType: 'invalidFilter',
      detail: expect.stringContaining('not yet enabled'),
    });
  });

  it('501 for sortBy/sortOrder (§3.4.2.3 unimplemented in M2; Table 8 501)', async () => {
    const { adapter } = suiteWith(row(1));
    for (const query of [{ sortBy: 'userName' }, { sortOrder: 'ascending' }]) {
      const error = await adapter.list(query).then(
        () => { throw new Error('expected ScimError 501'); },
        (thrown: unknown) => thrown,
      );
      expect(error).toBeInstanceOf(ScimError);
      expect((error as ScimError).status).toBe(501);
      expect((error as ScimError).scimType).toBeUndefined();
    }
  });

  it('list items carry commons and getMeta-driven meta stamps', async () => {
    const { adapter } = suiteWith(row(1));
    const body = await adapter.list({ count: '1' });

    expect(body.Resources?.[0].meta).toEqual({
      resourceType: 'User',
      location: '/scim/v2/Users/id-1',
      created: '2026-01-01T00:00:00Z',
      lastModified: '2026-01-01T00:00:00Z',
    });
  });

  it('applies §3.9 attribute selection against every page row', async () => {
    const { adapter } = suiteWith(row(1), row(2));
    const body = await adapter.list({ attributes: ['userName'] });

    for (const resource of body.Resources ?? []) {
      expect(Object.keys(resource)).toEqual(expect.arrayContaining(['schemas', 'id', 'userName']));
      expect(resource.active).toBeUndefined();
    }
  });
});

describe('password never leaks (RFC 7643 §7.2 writeOnly)', () => {
  it('strips a mapper bug leaking password into toScim output', async () => {
    const { mapper } = makeMemorySuite([bjensen]);
    const leaky: ScimUserMapper<Row> = { ...mapper, toScim: (r) => ({ ...mapper.toScim(r), password: 'secret' }) };
    const leakyAdapter = new ScimUserAdapter({ userService: {
      ...{
        findById: async () => bjensen,
        findByUserName: async () => null,
        findByExternalId: async () => null,
        create: async (r) => r,
        update: async (r) => r,
        deleteById: async () => undefined,
        list: async () => ({ totalResults: 1, items: [bjensen] }),
      } satisfies ScimUserService<Row>,
    }, userMapper: leaky, basePath: '/scim/v2', maxResultsPerPage: 200 });

    const detail = await leakyAdapter.detail(bjensen.id);
    expect('password' in detail.resource).toBe(false);
    expect(JSON.stringify(detail.resource)).not.toContain('secret');

    const listed = await leakyAdapter.list({});
    expect('password' in (listed.Resources?.[0] ?? {})).toBe(false);
  });
});

describe('meta honesty (no fabricated timestamps)', () => {
  it('omits created/lastModified when the mapper offers none', async () => {
    const { mapper } = makeMemorySuite([bjensen]);
    const bare = new ScimUserAdapter({
      userService: {
        findById: async () => bjensen,
        findByUserName: async () => null,
        findByExternalId: async () => null,
        create: async (r) => r,
        update: async (r) => r,
        deleteById: async () => undefined,
        list: async () => ({ totalResults: 0, items: [] }),
      },
      userMapper: { ...mapper, getMeta: undefined },
      basePath: '/scim/v2',
      maxResultsPerPage: 200,
    });

    const result = await bare.detail(bjensen.id);
    expect(result.resource.meta).toEqual({
      resourceType: 'User',
      location: '/scim/v2/Users/2819c223',
    });
  });
});
