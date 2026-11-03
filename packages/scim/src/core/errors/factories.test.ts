import { describe, expect, it } from 'vitest';
import { ERROR_SCHEMA_URI, toErrorBody } from './body';
import * as f from './factories';
import { SCIM_ERROR, ScimError, isScimError } from './scim-error';

/**
 * Status/type expectations transcribed from RFC 7644 §3.12:
 * Table 9 (docs/rfc/rfc7644.txt lines 3819–3909) + Table 8.
 */
const TABLE_9 = [
  ['invalidFilter', 400],
  ['tooMany', 400],
  ['noTarget', 400],
  ['invalidValue', 400],
  ['invalidSyntax', 400],
  ['invalidPath', 400],
  ['invalidVers', 400],
  ['sensitive', 400],
  ['mutability', 400],
  ['uniqueness', 409],
] as const;

describe('scimType factories (RFC 7644 §3.12 Table 9)', () => {
  it.each(TABLE_9)('%s → HTTP %i', (keyword, expectedStatus) => {
    const err = f[keyword]();
    expect(err.status).toBe(expectedStatus);
    expect(err.scimType).toBe(keyword);
    expect(isScimError(err)).toBe(true);
    expect(err[SCIM_ERROR]).toBe(true);
  });

  it.each(TABLE_9.map(([k]) => k))('%s falls back to a non-empty detail', (keyword) => {
    const err = f[keyword]();
    expect(err.detail).toBeTruthy();
    expect(err.message).toBe(err.detail);
  });

  it('accepts a custom detail and cause', () => {
    const cause = new Error('upstream');
    const err: ScimError = f.uniqueness({ detail: 'userName "bjensen" already exists', cause });

    expect(err.detail).toBe('userName "bjensen" already exists');
    expect((err as { cause?: unknown }).cause).toBe(cause);
  });

  it('notFound and internal carry NO scimType (no Table 9 row)', () => {
    expect(f.notFound().status).toBe(404);
    expect(f.notFound().scimType).toBeUndefined();
    expect(f.internal().status).toBe(500);
    expect(f.internal().scimType).toBeUndefined();
  });
});

describe('toErrorBody (RFC 7644 §3.12 ErrorResponse)', () => {
  it('renders the schemas URN and a JSON-string status', () => {
    const body = toErrorBody(new ScimError({ status: 400, scimType: 'invalidPath', detail: 'bad path' }));

    expect(body).toEqual({
      schemas: [ERROR_SCHEMA_URI],
      status: '400',
      scimType: 'invalidPath',
      detail: 'bad path',
    });
  });

  it('omits scimType and detail when absent', () => {
    const body = toErrorBody(new ScimError({ status: 404 }));

    expect(body).toEqual({
      schemas: [ERROR_SCHEMA_URI],
      status: '404',
    });
    expect('scimType' in body).toBe(false);
    expect('detail' in body).toBe(false);
  });

  it('matches the §3.12 example shape for a 404', () => {
    const body = toErrorBody(
      f.notFound({ detail: 'Resource 2819c223-7f76-453a-919d-413861904646 not found' }),
    );

    expect(body.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:Error']);
    expect(body.status).toBe('404');
    expect(body.detail).toBe('Resource 2819c223-7f76-453a-919d-413861904646 not found');
  });
});
