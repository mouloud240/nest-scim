/**
 * Error taxonomy + guard corpus — every §3.12 wire mapping exercised over
 * REAL HTTP, plus the guard-boundary decision (M2 locked: guards cover the
 * `/Users` routes ONLY, discovery stays unguarded).
 *
 * RFC anchors (docs/rfc/rfc7644.txt, grep-verified during T2d):
 * - §3.12   every error body follows the ErrorResponse schema
 * - Table 9 keywords: `uniqueness` (409), `invalidFilter` (400),
 *   `invalidValue` (400) — while 404/401/501 carry NO keyword
 * - Table 8 status 501 = "service provider does not support the request
 *   operation, e.g., PATCH" → M3: asserted via an SPC override app
 *   (patch.supported: false); the default provider PATCHes for real
 * - §3.4.2 filter/sort params → implemented-or-501/400 discipline
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { CanActivate, UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { buildScimE2eApp, e2e, SCIM_ERROR_URN, scimBody } from './harness';
import type { ScimUserService } from '../spi';

const CORE_URN = 'urn:ietf:params:scim:schemas:core:2.0:User';

/** Always refuses — the strictest realistic guard (401, not 403). */
class DenyAllGuard implements CanActivate {
  canActivate(): never {
    throw new UnauthorizedException('Bearer token required');
  }
}

/** SPI that always explodes — drives the unknown-error → generic 500 path. */
class ExplodingUserService implements ScimUserService<never> {
  findById = async (): Promise<never> => {
    throw new Error('boom: secret db credentials');
  };
  findByUserName = async (): Promise<never> => {
    throw new Error('boom');
  };
  findByExternalId = async (): Promise<never> => {
    throw new Error('boom');
  };
  create = async (): Promise<never> => {
    throw new Error('boom');
  };
  update = async (): Promise<never> => {
    throw new Error('boom');
  };
  deleteById = async (): Promise<never> => {
    throw new Error('boom');
  };
  list = async (): Promise<never> => {
    throw new Error('boom');
  };
}

describe('guard boundary (M2 locked decision)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  const server = () => request(app.getHttpServer());

  beforeAll(async () => {
    const built = await buildScimE2eApp({ auth: DenyAllGuard });
    app = built.app;
    close = built.close;
  });

  afterAll(async () => {
    await close();
  });

  it('POST /Users is guarded → 401 ErrorResponse WITHOUT a scimType', async () => {
    const res = await server()
      .post('/scim/v2/Users')
      .send(e2e.USER_PAYLOAD)
      .expect(401)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(res) as Record<string, unknown>;
    expect(error.schemas).toEqual([SCIM_ERROR_URN]);
    expect(error.status).toBe('401');
    expect('scimType' in error).toBe(false); // foreign HttpException: no keyword
  });

  it('discovery endpoints stay UNGUARDED by default (ServiceProviderConfig)', async () => {
    const res = await server().get('/scim/v2/ServiceProviderConfig').expect(200);
    const body = scimBody(res) as Record<string, unknown>;
    expect(typeof body.filter).toBe('object'); // RFC 7643 §5 /filter is REQUIRED
  });

  it('Schemas discovery is unguarded too, as a ListResponse envelope', async () => {
    const res = await server().get('/scim/v2/Schemas').expect(200);
    const body = scimBody(res) as Record<string, unknown>;
    expect(body.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:ListResponse']);
    expect((body.Resources as unknown[]).length).toBeGreaterThan(0);
  });

  it('an array of guards covers /Users as well', async () => {
    const second = await buildScimE2eApp({ auth: [DenyAllGuard, DenyAllGuard] });
    try {
      await request(second.app.getHttpServer()).post('/scim/v2/Users').send(e2e.USER_PAYLOAD).expect(401);
    } finally {
      await second.close();
    }
  });
});

describe('error taxonomy on the wire (RFC 7644 §3.12, Table 8/9)', () => {
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

  it('409 uniqueness on duplicate userName (§3.3, Table 9)', async () => {
    await server().post('/scim/v2/Users').send(e2e.USER_PAYLOAD).expect(201);

    const res = await server()
      .post('/scim/v2/Users')
      .send(e2e.USER_PAYLOAD)
      .expect(409)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(res) as Record<string, unknown>;
    expect(error).toEqual({
      schemas: [SCIM_ERROR_URN],
      status: '409',
      scimType: 'uniqueness',
      detail: expect.any(String),
    });
  });

  it('400 invalidValue when the required userName is missing (Table 9)', async () => {
    const res = await server()
      .post('/scim/v2/Users')
      .send({ schemas: [CORE_URN] })
      .expect(400)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(res) as Record<string, unknown>;
    expect(error.status).toBe('400');
    expect(error.scimType).toBe('invalidValue');
  });

  it('400 invalidSyntax when schemas does not name the core User schema', async () => {
    const res = await server()
      .post('/scim/v2/Users')
      .send({ schemas: ['urn:something:else'], userName: 'x' })
      .expect(400);
    expect((scimBody(res) as Record<string, unknown>).scimType).toBe('invalidSyntax');
  });

  it('404 notFound for an unknown id — carries NO scimType (Table 9)', async () => {
    const res = await server()
      .get('/scim/v2/Users/00000000-0000-0000-0000-000000000000')
      .expect(404)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(res) as Record<string, unknown>;
    expect(error.schemas).toEqual([SCIM_ERROR_URN]);
    expect(error.status).toBe('404');
    expect('scimType' in error).toBe(false);
  });

  it('400 invalidFilter on the wire for syntactically broken ?filter=', async () => {
    const res = await server()
      .get('/scim/v2/Users?filter=userName eq')
      .expect(400)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(res) as Record<string, unknown>;
    expect(error.status).toBe('400');
    expect(error.scimType).toBe('invalidFilter');
  });

  it('501 (NO scimType) for sortBy/sortOrder — Table 8 unsupported params', async () => {
    const res = await server()
      .get('/scim/v2/Users?sortBy=userName&sortOrder=ascending')
      .expect(501)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(res) as Record<string, unknown>;
    expect(error.status).toBe('501');
    expect('scimType' in error).toBe(false);
  });

  it('PATCH on an unknown id → 404 BEFORE body validation (adapter 404-first order)', async () => {
    // M3 note: since PatchOps ride the same app, the legacy "501 until M3"
    // probe is replaced by this sanity check — the route is live and its
    // ordering (501 → 404 → body) is assertable through real HTTP.
    const res = await server()
      .patch('/scim/v2/Users/completely-unknown-id')
      .send({ schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'remove', path: 'active' }] })
      .expect(404)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(res) as Record<string, unknown>;
    expect(error.status).toBe('404');
    expect('scimType' in error).toBe(false);
  });

  it('malformed application/json → the USER bootstrap parser owns that 400 (library ships zero platform code)', async () => {
    // Parse errors surface in the application's express middleware chain,
    // BEFORE the SCIM controllers run → answered by the express/Nest
    // default handler (application/json, no §3.12 envelope). Shaping those
    // is user-bootstrap responsibility; responses WRITTEN BY the library
    // are always scim+json (asserted everywhere else in this corpus).
    const res = await server()
      .post('/scim/v2/Users')
      .set('Content-Type', 'application/json')
      .send('{not-json')
      .expect(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('SPC override: patch.supported=false → Table 8 501 e2e (M3 wiring)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  const server = () => request(app.getHttpServer());

  beforeAll(async () => {
    const built = await buildScimE2eApp({
      serviceProviderConfig: { patch: { supported: false } },
    });
    app = built.app;
    close = built.close;
  });

  afterAll(async () => {
    await close();
  });

  it('501 (NO scimType) BEFORE any lookup — response mirrors the SPC claim', async () => {
    const res = await server()
      .patch('/scim/v2/Users/does-not-matter')
      .send({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        Operations: [{ op: 'remove', path: 'active' }],
      })
      .expect(501)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(res) as Record<string, unknown>;
    expect(error.schemas).toEqual([SCIM_ERROR_URN]);
    expect(error.status).toBe('501');
    expect('scimType' in error).toBe(false);
  });
});

describe('unknown internal failure → generic 500 (§3.12 discipline)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;  const server = () => request(app.getHttpServer());

  beforeAll(async () => {
    const built = await buildScimE2eApp({ userService: ExplodingUserService });
    app = built.app;
    close = built.close;
  });

  afterAll(async () => {
    await close();
  });

  it('hides the raw cause on the wire, answers the generic detail', async () => {
    const res = await server()
      .get('/scim/v2/Users/whatever')
      .expect(500)
      .expect('Content-Type', /application\/scim\+json/);

    const error = scimBody(res) as Record<string, unknown>;
    expect(error).toEqual({
      schemas: [SCIM_ERROR_URN],
      status: '500',
      detail: 'An internal error occurred. The incident has been logged.',
    });
    expect(JSON.stringify(error)).not.toContain('boom');

    // list flow: the exploding service must not 500 with HTML or raw text
    const listed = await server().get('/scim/v2/Users').expect(500);
    expect(listed.headers['content-type']).toMatch(/application\/scim\+json/);
  });
});
