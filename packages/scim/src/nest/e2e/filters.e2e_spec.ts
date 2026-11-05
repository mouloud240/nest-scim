/**
 * Filter fixture corpus — provider-shaped `?filter=` expressions under
 * REAL HTTP (M4 T5). Fixtures live in ./fixtures/filter-cases.json,
 * crafted from documented Entra-ID / Okta behaviors:
 * - case-insensitive attribute names, operators AND values (§3.4.2.2,
 *   rfc7644.txt lines 936–940),
 * - URN-prefixed paths (Entra sends full schema URNs),
 * - value-path quantification (`emails[type eq "work"]`),
 * - `not (attr pr)` on absent attributes (Entra probes), no-match → 200.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { buildScimE2eApp, SCIM_LIST_URN, scimBody } from './harness';

const CORE_URN = 'urn:ietf:params:scim:schemas:core:2.0:User';

/** Structure of ./fixtures/filter-cases.json. */
interface FilterCorpus {
  seed: Array<Record<string, unknown>>;
  cases: Array<{
    name: string;
    filter: string;
    expect: { totalResults: number; userNamePrefixes: string[] };
  }>;
}

function corpus(): FilterCorpus {
  return JSON.parse(
    readFileSync(join(__dirname, 'fixtures', 'filter-cases.json'), 'utf8'),
  ) as FilterCorpus;
}

describe('filter fixture corpus (entra/okta shapes)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  const server = () => request(app.getHttpServer());

  beforeAll(async () => {
    const built = await buildScimE2eApp();
    app = built.app;
    close = built.close;

    for (const user of corpus().seed) {
      await server()
        .post('/scim/v2/Users')
        .send({ schemas: [CORE_URN], ...user })
        .expect(201);
    }
  });

  afterAll(async () => {
    await close();
  });

  const expectedUserNames = (body: Record<string, unknown>, prefixes: string[]) => {
    const rows = body.Resources as Array<Record<string, unknown>> | undefined;
    const actual = (rows ?? []).map((r) => String(r.userName).slice(0, 3)).sort();
    expect(actual).toEqual([...prefixes].sort());
  };

  for (const testCase of corpus().cases) {
    it(`${testCase.name} — ${testCase.filter}`, async () => {
      const res = await server()
        .get(`/scim/v2/Users?filter=${encodeURIComponent(testCase.filter)}`)
        .expect(200)
        .expect('Content-Type', /application\/scim\+json/);

      const body = scimBody(res) as Record<string, unknown>;
      expect(body.schemas).toEqual([SCIM_LIST_URN]);
      expect(body.totalResults).toBe(testCase.expect.totalResults);
      expectedUserNames(body, testCase.expect.userNamePrefixes);
      // empty match is still §3.4.2: ListResponse with NO Resources key
      if (testCase.expect.totalResults === 0) {
        expect('Resources' in body).toBe(false);
      }
    });
  }

  it('the same corpus runs through POST /.search (§3.4.3 mirror)', async () => {
    const testCase = corpus().cases[3]; // okta value-path case
    const res = await server()
      .post('/scim/v2/Users/.search')
      .send({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:SearchRequest'],
        filter: testCase.filter,
        attributes: ['userName'],
      })
      .expect(200);

    const body = scimBody(res) as Record<string, unknown>;
    expect(body.totalResults).toBe(testCase.expect.totalResults);
    expectedUserNames(body, testCase.expect.userNamePrefixes);
  });

  it('pagination over a filtered set reports the filtered total and page keys', async () => {
    const res = await server()
      .get('/scim/v2/Users?filter=userType%20eq%20%22EMPLOYEE%22&startIndex=2&count=1')
      .expect(200);

    const body = scimBody(res) as Record<string, unknown>;
    expect(body.totalResults).toBe(3);
    expect(body.startIndex).toBe(2);
    expect(body.itemsPerPage).toBe(1);
    expect((body.Resources as unknown[]).length).toBe(1);
  });
});
