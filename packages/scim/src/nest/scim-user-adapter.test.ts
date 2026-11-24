import { describe, expect, it } from 'vitest';
import { ScimError } from '../core/errors/scim-error';
import type { ComparisonOp, DomainFilter } from '../core/filters/domain-filter';
import { Page } from '../core/types/list';
import { PATCH_OP_SCHEMA, PatchRequest } from '../core/types/patch';
import { SCIM_USER_SCHEMA, ScimUserCreate } from '../core/types/user';
import { ScimUserMapper, ScimUserService } from './spi';
import { EMPTY_PARSED_LIST_QUERY, ScimUserAdapter } from './scim-user-adapter';

/* ── In-memory SPI stand-in ──────────────────────────────────────────── */

interface Row {
  id: string;
  userName: string;
  email: string | null;
  createdAt: Date;
}

const CREATED_AT = new Date('2026-01-01T00:00:00Z');

/** Minimal store-side interpreter (the mapping target of the domain tree). */
function valueAt(row: object, path: string): unknown {
  let value: unknown = row;
  for (const segment of path.split('.')) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function compare(actual: unknown, op: ComparisonOp, expected: unknown, ignoreCase: boolean): boolean {
  if (actual === null || actual === undefined) return false;
  const fold = (v: unknown): unknown => (ignoreCase && typeof v === 'string' ? v.toLowerCase() : v);
  const left = fold(actual);
  const right = fold(expected);
  switch (op) {
    case 'eq':
      return left === right;
    case 'co':
      return typeof left === 'string' && typeof right === 'string' && left.includes(right);
    case 'sw':
      return typeof left === 'string' && typeof right === 'string' && left.startsWith(right);
    case 'ew':
      return typeof left === 'string' && typeof right === 'string' && left.endsWith(right);
    case 'gt':
      return (typeof left === 'number' && typeof right === 'number' && left > right) ||
        (typeof left === 'string' && typeof right === 'string' && left > right);
    case 'lt':
      return (typeof left === 'number' && typeof right === 'number' && left < right) ||
        (typeof left === 'string' && typeof right === 'string' && left < right);
    case 'ge':
      return left === right || (typeof left === 'number' && typeof right === 'number' && left > right) ||
        (typeof left === 'string' && typeof right === 'string' && left > right);
    case 'le':
      return left === right || (typeof left === 'number' && typeof right === 'number' && left < right) ||
        (typeof left === 'string' && typeof right === 'string' && left < right);
  }
}

function testWhere(row: object, where: DomainFilter): boolean {
  switch (where.op) {
    case 'and':
      return where.filters.every((child) => testWhere(row, child));
    case 'or':
      return where.filters.some((child) => testWhere(row, child));
    case 'not':
      return !testWhere(row, where.filter);
    case 'pr':
      return isPresent(valueAt(row, where.path));
    case '[]': {
      const values = valueAt(row, where.path);
      return Array.isArray(values) && values.some((element) => testWhere(element, where.itemFilter));
    }
    default:
      return compare(valueAt(row, where.path), where.op, where.value, where.ignoreCase);
  }
}

function makeMemorySuite(rows: Row[] = [], maxResultsPerPage = 200) {
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
    list: async ({ startIndex, count, where }) => {
      const rows = where ? store.rows.filter((r) => testWhere(r, where)) : store.rows;
      const offset = startIndex - 1;
      return { items: rows.slice(offset, offset + count), totalResults: rows.length } satisfies Page<Row>;
    },
  };
  const mapper: ScimUserMapper<Row> = {
    attributePathMap: {
      userName: 'userName',
      'emails.value': 'email',
    },
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
    maxResultsPerPage,
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
    const result = await adapter.detail('2819c223', adapter.parseListQuery({ attributes: ['userName'] }));

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

describe('parseListQuery (wire → typed, RFC §3.4.2.4 / §3.9)', () => {
  it('normalizes startIndex: absent/garbage/negative all → 1', () => {
    const { adapter } = makeMemorySuite();

    expect(adapter.parseListQuery({}).startIndex).toBe(1);
    expect(adapter.parseListQuery({ startIndex: '5' }).startIndex).toBe(5); // 1-based, raw
    expect(adapter.parseListQuery({ startIndex: 'abc' }).startIndex).toBe(1);
    expect(adapter.parseListQuery({ startIndex: '0' }).startIndex).toBe(1);
    expect(adapter.parseListQuery({ startIndex: '-3' }).startIndex).toBe(1);
  });

  it('normalizes count: absent → provider max, garbage → max, <0 → 0, clamped to max', () => {
    const { adapter } = makeMemorySuite();

    expect(adapter.parseListQuery({}).count).toBe(200);
    expect(adapter.parseListQuery({ count: 'abc' }).count).toBe(200);
    expect(adapter.parseListQuery({ count: '-2' }).count).toBe(0);
    expect(adapter.parseListQuery({ count: '999999' }).count).toBe(200);
    expect(adapter.parseListQuery({ count: '10' }).count).toBe(10);
  });

  it('records pagination PRESENCE from the raw keys, not the parsed values', () => {
    const { adapter } = makeMemorySuite();

    const absent = adapter.parseListQuery({});
    expect(absent.explicitStartIndex).toBe(false);
    expect(absent.explicitCount).toBe(false);

    const paged = adapter.parseListQuery({ startIndex: '2', count: '1' });
    expect(paged.explicitStartIndex).toBe(true);
    expect(paged.explicitCount).toBe(true);

    // garbage presence is still presence — §3.4.2 envelope semantics
    const garbage = adapter.parseListQuery({ count: 'nonsense' });
    expect(garbage.explicitCount).toBe(true);
    expect(garbage.count).toBe(200);
  });

  it('comma-splits the §3.9 attribute selection lists', () => {
    const { adapter } = makeMemorySuite();

    expect(adapter.parseListQuery({ attributes: 'userName, name.givenName ' }).attributes).toEqual([
      'userName',
      'name.givenName',
    ]);
    expect(adapter.parseListQuery({ attributes: ',' }).attributes).toBeUndefined();
    expect(adapter.parseListQuery({ excludedAttributes: 'emails' }).excludedAttributes).toEqual(['emails']);
  });

  it('compiles a present filter to the domain tree; empty filter means no filter', () => {
    const { adapter } = makeMemorySuite();

    const parsed = adapter.parseListQuery({ filter: 'userName pr' });
    expect(parsed.where).toEqual({ op: 'pr', path: 'userName' });
    // an EMPTY filter value is treated as no filter requested
    expect(adapter.parseListQuery({ filter: '' }).where).toBeUndefined();
  });

  it('rejects unmapped filter attributes with 400 invalidFilter at parse time', () => {
    const { adapter } = makeMemorySuite();

    expect(() => adapter.parseListQuery({ filter: 'nickName eq "x"' })).toThrow(
      /not supported by this service provider/,
    );
  });

  it('rejects filter syntax errors with 400 invalidFilter at parse time', () => {
    const { adapter } = makeMemorySuite();

    try {
      adapter.parseListQuery({ filter: 'userName eq' });
      expect.unreachable();
    } catch (error) {
      expect((error as ScimError).scimType).toBe('invalidFilter');
      expect((error as ScimError).status).toBe(400);
    }
  });

  it('rejects sortBy/sortOrder presence with 501 and no scimType', () => {
    const { adapter } = makeMemorySuite();

    for (const query of [{ sortBy: 'userName' }, { sortOrder: 'descending' }]) {
      try {
        adapter.parseListQuery(query);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(ScimError);
        expect((error as ScimError).status).toBe(501);
        expect((error as ScimError).scimType).toBeUndefined();
      }
    }
  });

  it('parses nothing when handed undefined (controllers may omit @Query binding data)', () => {
    const { adapter } = makeMemorySuite();
    const parsed = adapter.parseListQuery(undefined);

    expect(parsed.startIndex).toBe(1);
    expect(parsed.count).toBe(200);
    expect(parsed.attributes).toBeUndefined();
    expect(parsed.explicitStartIndex).toBe(false);
    expect(parsed).not.toBe(EMPTY_PARSED_LIST_QUERY);
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
    const body = await adapter.list(adapter.parseListQuery({ startIndex: '2', count: '2' }));

    expect(body.startIndex).toBe(2);
    expect(body.itemsPerPage).toBe(2);
    expect(body.totalResults).toBe(5);
    expect(body.Resources?.map((r) => r.userName)).toEqual(['user2', 'user3']);
    expect(body.Resources?.[0]).toMatchObject({ id: 'id-2', active: true });
  });

  it('startIndex defaults to 1 and interprets <1 as 1 (Table 6)', async () => {
    const { adapter } = suiteWith(row(1), row(2));
    const negative = await adapter.list(adapter.parseListQuery({ startIndex: '-3', count: '1' }));
    const garbage = await adapter.list(adapter.parseListQuery({ startIndex: 'abc', count: '1' }));

    expect(negative.startIndex).toBe(1);
    expect(negative.Resources?.[0].userName).toBe('user1');
    expect(garbage.startIndex).toBe(1);
  });

  it('count defaults to the provider maximum and clamps to it', async () => {
    const { adapter } = suiteWith(...Array.from({ length: 250 }, (_, i) => row(i + 1)));

    const body = await adapter.list(adapter.parseListQuery({}));
    expect(body.totalResults).toBe(250);
    expect(body.itemsPerPage).toBe(200); // maxResultsPerPage default, §3.4.2.4

    const body2 = await adapter.list(adapter.parseListQuery({ count: '999999' }));
    expect(body2.itemsPerPage).toBe(200); // clamped

    const body3 = await adapter.list(adapter.parseListQuery({ count: '10' }));
    expect(body3.itemsPerPage).toBe(10);
  });

  it('negative count is interpreted as 0 (Table 6)', async () => {
    const { adapter } = suiteWith(row(1));
    const body = await adapter.list(adapter.parseListQuery({ count: '-2' }));

    expect(body.itemsPerPage).toBe(0);
    expect(body.totalResults).toBe(1);
    expect(body.Resources).toEqual([]);
  });

  it('unspecified pagination + exact-fit totals stays an unpaginated envelope', async () => {
    const { adapter } = suiteWith(row(1));
    const body = await adapter.list(adapter.parseListQuery({}));

    expect(body).toEqual({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 1,
      Resources: [expect.objectContaining({ userName: 'user1', id: 'id-1' })],
    });
    expect('startIndex' in body).toBe(false);
  });

  it('filters rows and scopes totalResults to the filter (§3.4.2.2)', async () => {
    const { adapter } = suiteWith(row(1), { ...row(2), email: 'w@example.com' }, row(3), row(4));
    const body = await adapter.list(adapter.parseListQuery({ filter: 'emails.value co "@example.com"' }));

    expect(body.totalResults).toBe(1);
    expect(body.Resources?.map((r) => r.userName)).toEqual(['user2']);
    // filtered + explicitly paginated? no pagination sent — sparse envelope
    expect('startIndex' in body).toBe(false);
  });

  it('400 tooMany when a filtered set exceeds the provider ceiling', async () => {
    const rows = Array.from({ length: 205 }, (_, i) => row(i + 1));
    const { adapter } = makeMemorySuite(rows, 200);
    try {
      await adapter.list(adapter.parseListQuery({ filter: 'userName pr' }));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ScimError);
      expect((error as ScimError).status).toBe(400);
      expect((error as ScimError).scimType).toBe('tooMany');
    }
    // unfiltered totals above the ceiling are legal (plain pagination)
    await expect(adapter.list(adapter.parseListQuery({ count: '0' }))).resolves.toMatchObject({
      totalResults: 205,
    });
  });

  it('501 for sortBy/sortOrder (§3.4.2.3 unimplemented in M2) — rejected at PARSE time', () => {
    const { adapter } = suiteWith(row(1));
    for (const query of [{ sortBy: 'userName' }, { sortOrder: 'ascending' }]) {
      try {
        adapter.parseListQuery(query);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(ScimError);
        expect((error as ScimError).status).toBe(501);
        expect((error as ScimError).scimType).toBeUndefined();
      }
    }
  });

  it('list items carry commons and getMeta-driven meta stamps', async () => {
    const { adapter } = suiteWith(row(1));
    const body = await adapter.list(adapter.parseListQuery({ count: '1' }));

    expect(body.Resources?.[0].meta).toEqual({
      resourceType: 'User',
      location: '/scim/v2/Users/id-1',
      created: '2026-01-01T00:00:00Z',
      lastModified: '2026-01-01T00:00:00Z',
    });
  });

  it('applies §3.9 attribute selection against every page row', async () => {
    const { adapter } = suiteWith(row(1), row(2));
    const body = await adapter.list(adapter.parseListQuery({ attributes: ['userName'] }));

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

    const listed = await leakyAdapter.list(EMPTY_PARSED_LIST_QUERY);
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

describe('patch flow (RFC 7644 §3.5.2)', () => {
  /** Wire PATCH body helper — schemas URN per lines 1804–1806. */
  function patchBody(operations: unknown[]): PatchRequest {
    return { schemas: [PATCH_OP_SCHEMA], Operations: operations as PatchRequest['Operations'] };
  }

  it('applies ops through the mapper round-trip and returns the full resource', async () => {
    const { adapter } = makeMemorySuite([bjensen]);
    const result = await adapter.patch('2819c223', patchBody([
      { op: 'replace', path: 'emails[type eq "work"].value', value: 'new@x.com' },
    ]));

    expect(result.resource.userName).toBe('bjensen'); // untouched attr survives
    expect(result.location).toBe('/scim/v2/Users/2819c223');
    const emails = result.resource.emails as Array<{ value?: string; type?: string }>;
    expect(emails).toEqual([{ value: 'new@x.com', type: 'work' }]);
  });

  it('404 must come FIRST — even before body validation (Table 8)', async () => {
    const { adapter } = makeMemorySuite([]);
    await expect(adapter.patch('ghost', { totally: 'broken' })).rejects.toMatchObject({ status: 404 });
  });

  it('400 invalidSyntax for a body that omits the PatchOp URN or Operations', async () => {
    const { adapter } = makeMemorySuite([bjensen]);
    await expect(adapter.patch('2819c223', { Operations: [] })).rejects.toMatchObject({
      status: 400,
      scimType: 'invalidSyntax',
    });
    await expect(adapter.patch('2819c223', { schemas: [PATCH_OP_SCHEMA] })).rejects.toMatchObject({
      status: 400,
      scimType: 'invalidSyntax',
    });
  });

  it('is ATOMIC at the store: a failing op 2 leaves the row untouched and update() never runs', async () => {
    const { adapter, store } = makeMemorySuite([bjensen]);
    await expect(adapter.patch('2819c223', patchBody([
      { op: 'replace', path: 'displayName', value: 'Halfway Name' }, // op 1 succeeds
      { op: 'replace', path: 'emails[type ne "work"].value', value: 'x@y.z' }, // op 2: noTarget
    ]))).rejects.toMatchObject({ status: 400, scimType: 'noTarget' });

    expect(store.updated).toBe(0); // the ONLY write never ran (§3.5.2 line 1931)
    expect(store.rows[0]?.email).toBe('b@x.com'); // pre-patch state survives
    const after = await adapter.detail('2819c223', EMPTY_PARSED_LIST_QUERY);
    expect('displayName' in after.resource).toBe(false); // no half-applied state
  });

  it('409 uniqueness when the patch MOVES userName onto another row (Table 8)', async () => {
    const { adapter, store } = makeMemorySuite([
      bjensen,
      { id: 'other-row', userName: 'taken', email: null, createdAt: CREATED_AT },
    ]);
    await expect(adapter.patch('2819c223', patchBody([
      { op: 'replace', path: 'userName', value: 'taken' },
    ]))).rejects.toMatchObject({ status: 409, scimType: 'uniqueness' });
    expect(store.updated).toBe(0);

    // renaming to a FREE name is fine
    const renamed = await adapter.patch('2819c223', patchBody([
      { op: 'replace', path: 'userName', value: 'free-name' },
    ]));
    expect(renamed.resource.userName).toBe('free-name');
  });

  it('400 mutability when a patch unassigns the REQUIRED userName (§3.5.2.2)', async () => {
    const { adapter, store } = makeMemorySuite([bjensen]);
    await expect(adapter.patch('2819c223', patchBody([
      { op: 'remove', path: 'userName' },
    ]))).rejects.toMatchObject({ status: 400, scimType: 'mutability' });
    expect(store.updated).toBe(0);
  });

  it('remove ops unassign through the strict-absence round-trip (empties the attr)', async () => {
    const { adapter } = makeMemorySuite([bjensen]);
    const result = await adapter.patch('2819c223', patchBody([
      { op: 'remove', path: 'emails[type eq "work"]' }, // engine: matches, removes record
    ]));
    expect(result.resource.emails).toBeUndefined(); // mapper strict-absence cleared
  });

  it('does NOT let wire ops touch commons (id/meta readOnly, RFC 7643 §3.1)', async () => {
    const { adapter } = makeMemorySuite([bjensen]);
    const result = await adapter.patch('2819c223', patchBody([
      { op: 'add', value: { meta: { location: 'https://evil.example' } } }, // resource-level add
    ]));
    expect(result.resource.meta?.location).toBe('/scim/v2/Users/2819c223'); // server-owned
  });

  it('projects ?attributes on the 200 response (§3.9 — MUST honor attributes)', async () => {
    const { adapter } = makeMemorySuite([bjensen]);
    const result = await adapter.patch(
      '2819c223',
      patchBody([{ op: 'replace', path: 'displayName', value: 'Babs' }]),
      adapter.parseListQuery({ attributes: ['userName'] }),
    );
    // only the selected attribute survives the projection (§3.9)
    expect(result.resource).toEqual({
      schemas: [SCIM_USER_SCHEMA],
      id: '2819c223',
      userName: 'bjensen',
    });
  });
});
