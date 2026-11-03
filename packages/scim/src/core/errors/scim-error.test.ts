import { describe, expect, it } from 'vitest';
import { SCIM_ERROR, ScimError, isScimError } from './scim-error';

describe('ScimError', () => {
  it('carries status, optional scimType and optional detail', () => {
    const err = new ScimError({ status: 400, scimType: 'invalidFilter', detail: 'bad filter' });

    expect(err.status).toBe(400);
    expect(err.scimType).toBe('invalidFilter');
    expect(err.detail).toBe('bad filter');
  });

  it('omits scimType/detail keys instead of storing undefined', () => {
    const err = new ScimError({ status: 404 });

    // RFC 7644 §3.12: scimType is OPTIONAL and has no keyword for 404/500.
    expect('scimType' in err).toBe(false);
    expect('detail' in err).toBe(false);
  });

  it('uses a coherent fallback message when detail is missing', () => {
    const err = new ScimError({ status: 404 });
    const withDetail = new ScimError({ status: 409, scimType: 'uniqueness', detail: 'userName taken' });

    expect(err.message).toContain('404');
    expect(withDetail.message).toBe('userName taken');
  });

  it('is an Error and carries the registry identity symbol', () => {
    const err = new ScimError({ status: 400 });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ScimError');
    expect(err[SCIM_ERROR]).toBe(true);
    expect(err instanceof ScimError).toBe(true);
  });

  it('preserves a cause', () => {
    const cause = new Error('db down');
    const err = new ScimError({ status: 500, detail: 'internal', cause });

    expect((err as { cause?: unknown }).cause).toBe(cause);
  });
});

describe('isScimError', () => {
  it('accepts ScimError instances', () => {
    expect(isScimError(new ScimError({ status: 400 }))).toBe(true);
  });

  it('rejects plain Errors, numbers and non-error objects', () => {
    expect(isScimError(new Error('x'))).toBe(false);
    expect(isScimError(42)).toBe(false);
    expect(isScimError({ status: 400 })).toBe(false);
    expect(isScimError(null)).toBe(false);
  });
});
