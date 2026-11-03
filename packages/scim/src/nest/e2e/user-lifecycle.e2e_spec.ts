/**
 * E2E lifecycle corpus — POST → GET → list → PUT → DELETE against a real
 * Nest HTTP server (platform-express + supertest, dev-only).
 *
 * RFC anchors (docs/rfc/rfc7644.txt, all grep-verified in T2d):
 * - §3.3    create → 201 + Location header + full resource body
 * - §3.4.1  GET one → 200 + resource
 * - §3.4.2  list → ListResponse envelope with capital-R `Resources`
 * - §3.5.1  PUT replaces ALL attributes (absent ⇒ cleared), returns 200
 * - §3.5.3  DELETE → 204, body-less; a subsequent GET → 404
 * - Content-Type is `application/scim+json` on EVERY response
 * - scim+json REQUEST bodies are the application's bootstrap concern:
 *   without a body parser mounted for that media type, the adapter sees
 *   no body and answers 400 invalidSyntax (documented behavior, T3a).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import {
  buildScimE2eApp,
  e2e,
  SCIM_ERROR_URN,
  scimBody,
} from './harness';

let app: INestApplication;
let close: () => Promise<void>;
const server = () => request(app.getHttpServer());

// One app for the whole suite (bootstrap cost); every creation therefore
// needs a UNIQUE userName — §3.3 forces 409 otherwise.
let seq = 0;
function uniquePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...e2e.USER_PAYLOAD,
    userName: `bjensen${++seq}@example.com`,
    ...overrides,
  };
}

beforeAll(async () => {
  const built = await buildScimE2eApp();
  app = built.app;
  close = built.close;
});

afterAll(async () => {
  await close();
});

describe('create (RFC 7644 §3.3)', () => {
  it('POST /scim/v2/Users → 201 + Location + body with managed commons', async () => {
    const payload = uniquePayload();
    const res = await server()
      .post('/scim/v2/Users')
      .send(payload) // supertest sends as application/json
      .expect(201)
      .expect('Content-Type', /application\/scim\+json/);

    const body = scimBody(res) as Record<string, unknown>;
    expect(body.schemas).toEqual(['urn:ietf:params:scim:schemas:core:2.0:User']);
    expect(typeof body.id).toBe('string');
    expect(body.userName).toBe(payload.userName);

    const meta = body.meta as Record<string, string>;
    expect(meta.location).toBe(`/scim/v2/Users/${String(body.id)}`);
    expect(res.headers.location).toBe(`/scim/v2/Users/${String(body.id)}`);
    expect(meta.resourceType).toBe('User');
    expect(typeof meta.created).toBe('string'); // mapper tracks timestamps
  });
});

describe('detail (RFC 7644 §3.4.1)', () => {
  it('GET /scim/v2/Users/:id → 200 + the created representation', async () => {
    const created = await server().post('/scim/v2/Users').send(uniquePayload()).expect(201);
    const id = String((scimBody(created) as Record<string, unknown>).id);

    const res = await server()
      .get(`/scim/v2/Users/${id}`)
      .expect(200)
      .expect('Content-Type', /application\/scim\+json/);

    const body = scimBody(res) as Record<string, unknown>;
    expect(body.id).toBe(id);
    expect(body.displayName).toBe('Babs Jensen');
    expect(body.meta).toMatchObject({ resourceType: 'User', location: `/scim/v2/Users/${id}` });
  });
});

describe('list (RFC 7644 §3.4.2)', () => {
  it('returns the ListResponse envelope with capital-R Resources', async () => {
    const res = await server()
      .get('/scim/v2/Users')
      .expect(200)
      .expect('Content-Type', /application\/scim\+json/);

    const body = scimBody(res) as Record<string, unknown>;
    expect(body.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:ListResponse']);
    expect(Array.isArray(body.Resources)).toBe(true);
    expect(typeof body.totalResults).toBe('number');
    // No explicit pagination params ⇒ plain envelope (no startIndex/itemsPerPage keys)
    expect('startIndex' in body).toBe(false);
  });
});

describe('replace (RFC 7644 §3.5.1 — strict absence semantics)', () => {
  it('PUT removes attributes omitted from the payload and updates meta.lastModified', async () => {
    const created = await server().post('/scim/v2/Users').send(uniquePayload()).expect(201);
    const id = String((scimBody(created) as Record<string, unknown>).id);

    const reduced = {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: (scimBody(created) as Record<string, unknown>).userName,
      // displayName + emails ABSENT ⇒ mapper clears them
    };

    const res = await server()
      .put(`/scim/v2/Users/${id}`)
      .send(reduced)
      .expect(200)
      .expect('Content-Type', /application\/scim\+json/);

    const body = scimBody(res) as Record<string, unknown>;
    expect(body.id).toBe(id);
    expect(body.displayName).toBeUndefined(); // cleared
    expect(body.emails).toBeUndefined(); // cleared
  });
});

describe('delete (RFC 7644 §3.5.3)', () => {
  it('DELETE → 204 body-less, then GET → 404 ErrorResponse', async () => {
    const created = await server().post('/scim/v2/Users').send(uniquePayload()).expect(201);
    const id = String((scimBody(created) as Record<string, unknown>).id);

    // §3.5.3: 204 with NO content; Node/express strip all headers (incl.
    // Content-Type) on 204 per HTTP semantics — nothing to assert there.
    const deleted = await server().delete(`/scim/v2/Users/${id}`).expect(204);
    expect(deleted.text ?? '').toBe('');

    const gone = await server()
      .get(`/scim/v2/Users/${id}`)
      .expect(404)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(gone) as Record<string, unknown>;
    expect(error.schemas).toEqual([SCIM_ERROR_URN]);
    expect(error.status).toBe('404');
    expect('scimType' in error).toBe(false); // 404 carries no keyword (Table 9)
  });
});

describe('protocol media type (responses) + unparsed scim+json requests', () => {
  it('every error response is also application/scim+json', async () => {
    const res = await server().get('/scim/v2/Users/never-existed');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/scim\+json/);
  });

  it('an application/scim+json request WITHOUT a mounted parser arrives un-parsed → 400 invalidSyntax', async () => {
    // Documented behavior: the LIBRARY ships no HTTP-platform code; mounting
    // a scim+json body parser is the application's bootstrap responsibility.
    const res = await server()
      .post('/scim/v2/Users')
      .set('Content-Type', 'application/scim+json')
      .send(JSON.stringify(e2e.USER_PAYLOAD))
      .expect(400)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(res) as Record<string, unknown>;
    expect(error.schemas).toEqual([SCIM_ERROR_URN]);
    expect(error.status).toBe('400');
    expect(error.scimType).toBe('invalidSyntax');
  });
});
