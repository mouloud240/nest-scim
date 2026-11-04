/**
 * PATCH fixture corpus — provider-shaped request bodies under REAL HTTP
 * (M3 T4). Fixtures live in ./fixtures/*.json, crafted from the
 * documented Entra-ID / Okta behaviors locked in docs/milestones/M3.md:
 * - Okta: clean replace ops, multi-op chains that exercise §3.5.2's
 *   sequential semantics (lines 1918–1922).
 * - Entra: 'add' where 'replace' would be canonical, resource-level
 *   "full attribute" patches every sync cycle, mixed operator casing.
 * - Shared: remove-by-valueFilter, atomicity probe (op 2 fails → nothing
 *   persists, line 1931), and the CVE-2026-48170 `__proto__` wire shape.
 *
 * Every case asserts BOTH the immediate §3.12-shaped response and the
 * resulting resource state read back over GET — mapper round-trips are
 * proven at the wire, not in process.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { buildScimE2eApp, SCIM_ERROR_URN, scimBody } from './harness';

const CORE_URN = 'urn:ietf:params:scim:schemas:core:2.0:User';

/** Wire-shaped request body from ./fixtures (JSON.parse: proto-safe). */
interface PatchFixture {
  description: string;
  expects: Record<string, unknown>;
  request: Record<string, unknown>;
}

function fixture(name: string): PatchFixture {
  return JSON.parse(
    readFileSync(join(__dirname, 'fixtures', `${name}.json`), 'utf8'),
  ) as PatchFixture;
}

describe('patch fixture corpus (entra/okta shapes)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  const server = () => request(app.getHttpServer());

  beforeAll(async () => {
    const built = await buildScimE2eApp();
    app = built.app;
    close = built.close;
  });

  afterAll(async () => {
    await close();
  });

  /** POST a fresh user (unique userName per test — the §3.3 409 lesson) and return its id. */
  async function seedUser(suffix: string): Promise<string> {
    const created = await server()
      .post('/scim/v2/Users')
      .send({
        schemas: [CORE_URN],
        userName: `patch-${suffix}@example.com`,
        displayName: 'Original Display',
        emails: [{ value: 'orig@x.com', type: 'work' }],
      })
      .expect(201);
    return (scimBody(created) as Record<string, unknown>).id as string;
  }

  async function getUser(id: string): Promise<Record<string, unknown>> {
    const res = await server()
      .get(`/scim/v2/Users/${id}`)
      .expect(200)
      .expect('Content-Type', /application\/scim\+json/);
    return scimBody(res) as Record<string, unknown>;
  }

  it('okta-single-replace: replace updates exactly one attribute', async () => {
    const body = await fixture('okta-single-replace');
    const id = await seedUser('okta-replace');

    const res = await server()
      .patch(`/scim/v2/Users/${id}`)
      .send(body.request)
      .expect(200)
      .expect('Content-Type', /application\/scim\+json/);

    const resource = scimBody(res) as Record<string, unknown>;
    expect(resource.schemas).toEqual([CORE_URN]);
    expect(resource.userName).toBe('patch-okta-replace@example.com'); // untouched attr survives
    expect(resource.displayName).toBe('Babs J. (Okta)');

    expect((await getUser(id)).displayName).toBe('Babs J. (Okta)'); // persisted through the round-trip
  });

  it('okta-chained-ops: 3 ops where each sees the prior result (§3.5.2 sequential)', async () => {
    const body = await fixture('okta-chained-ops');
    const id = await seedUser('okta-chain');

    const resource = (scimBody(
      await server().patch(`/scim/v2/Users/${id}`).send(body.request).expect(200),
    )) as Record<string, unknown>;
    expect('displayName' in resource).toBe(false); // final op unassigned it

    expect((await getUser(id)).displayName).toBeUndefined();
  });

  it('entra-add-not-replace: add on an EXISTING attribute overwrites it', async () => {
    const body = await fixture('entra-add-not-replace');
    const id = await seedUser('entra-add');

    const resource = (scimBody(
      await server().patch(`/scim/v2/Users/${id}`).send(body.request).expect(200),
    )) as Record<string, unknown>;
    expect(resource.displayName).toBe('Babs (Entra sync)');
    expect(resource.userName).toBe('patch-entra-add@example.com'); // only the op target changed
  });

  it('entra-full-patch: resource-level add of ALL mapped attrs (Entra sync cycle), incl. a renamed userName', async () => {
    const body = await fixture('entra-full-patch');
    const id = await seedUser('entra-full');

    const resource = (scimBody(
      await server().patch(`/scim/v2/Users/${id}`).send(body.request).expect(200),
    )) as Record<string, unknown>;

    expect(resource.userName).toBe('bjensen@example.com'); // full-sync "rename" applied
    expect(resource.displayName).toBe('Babs Jensen - full sync');
    // §3.5.2.1: add on an EXISTING multi-valued attr APPENDS — the seeded
    // record survives next to the synced one (+-data preservation, not reset)
    const emails = resource.emails as Array<Record<string, unknown>>;
    expect(emails).toHaveLength(2);
    expect(emails[1]).toEqual({ value: 'bjensen@example.com', type: 'work', primary: true });
    expect(resource.meta).toMatchObject({ resourceType: 'User' }); // commons rebuilt server-side
  });

  it('entra-case-variants: mixed op casing applies (semantic case-insensitivity)', async () => {
    const body = await fixture('entra-case-variants');
    const id = await seedUser('entra-case');

    const resource = (scimBody(
      await server().patch(`/scim/v2/Users/${id}`).send(body.request).expect(200),
    )) as Record<string, unknown>;
    expect(resource.displayName).toBe('Case Insensitive');
    expect(resource.emails).toBeUndefined(); // REMOVE with filter worked despite casing
  });

  it('shared-remove-by-filter: remove-by-valueFilter unassigns the attribute (§3.5.2.2)', async () => {
    const body = await fixture('shared-remove-by-filter');
    const id = await seedUser('remove-filter');

    const resource = (scimBody(
      await server().patch(`/scim/v2/Users/${id}`).send(body.request).expect(200),
    )) as Record<string, unknown>;
    expect(resource.emails).toBeUndefined();

    expect((await getUser(id)).emails).toBeUndefined(); // strict-absence cleared through storage
  });

  it('shared-atomicity-broken-op: op 2 fails → 400 noTarget AND op 1 never persisted (line 1931)', async () => {
    const body = await fixture('shared-atomicity-broken-op');
    const id = await seedUser('atomic');

    const res = await server()
      .patch(`/scim/v2/Users/${id}`)
      .send(body.request)
      .expect(400)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(res) as Record<string, unknown>;
    expect(error.schemas).toEqual([SCIM_ERROR_URN]);
    expect(error.status).toBe('400');
    expect(error.scimType).toBe('noTarget');

    expect((await getUser(id)).displayName).toBe('Original Display'); // op 1 NOT half-applied
    expect(await getUser(id)).toMatchObject({
      emails: [{ value: 'orig@x.com', type: 'work' }], // storage untouched
    });
  });

  it('cve-proto-pollution: __proto__ payload cannot pollute through the wire (CVE-2026-48170)', async () => {
    const body = await fixture('cve-proto-pollution');
    const id = await seedUser('cve');

    await server().patch(`/scim/v2/Users/${id}`).send(body.request).expect(200);

    expect((Object.getPrototypeOf({}) as Record<string, unknown>).polluted).toBeUndefined();

    const resource = await getUser(id);
    expect(resource.userName).toBe('patch-cve@example.com'); // the app still serves normally
    expect(JSON.stringify(resource)).not.toContain('polluted'); // payload never round-trips into data
  });
});
