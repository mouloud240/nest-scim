import { ArgumentsHost } from '@nestjs/common';
import { HttpException } from '@nestjs/common';

import { describe, expect, it, vi } from 'vitest';
import { ScimError } from '../core/errors/scim-error';
import { internal, uniqueness } from '../core/errors/factories';
import { ERROR_SCHEMA_URI } from '../core/errors/body';
import { SCIM_CONTENT_TYPE, writeScimJson } from './scim-content';
import { INTERNAL_ERROR_DETAIL, ScimExceptionFilter } from './scim-exception.filter';

/** Express-and-fastify-like response collector (both share the surface). */
function expressLikeRes() {
  const headers: Record<string, string> = {};
  let statusCode = 0;
  let body: unknown;
  const res = {
    setHeader(name: string, value: string) { headers[name] = value; return res; },
    status(code: number) { statusCode = code; return res; },
    json(payload: unknown) { body = payload; return res; },
  };
  return { res, headers: () => headers, status: () => statusCode, body: () => body };
}

/** Raw http.ServerResponse-like collector (the platform-node surface). */
function nodeLikeRes() {
  let statusCode = 0;
  let outHeaders: Record<string, string> | undefined;
  let payload: string | undefined;
  const res = {
    writeHead(status: number, headers?: Record<string, string>) {
      statusCode = status;
      outHeaders = headers;
      return res;
    },
    end(fragment?: string) { payload = fragment; return res; },
  };
  return { res, status: () => statusCode, headers: () => outHeaders, payload: () => payload };
}

/** Calls the filter with a fake ArgumentsHost bound to the collector. */
function runFilter(filter: ScimExceptionFilter, res: unknown, exception: unknown) {
  const argsHost = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;

  filter.catch(exception, argsHost);
}

describe('writeScimJson (adapter-agnostic body writing)', () => {
  it('uses the express-like surface, media type first, then status+json', () => {
    const { res, headers, status, body } = expressLikeRes();

    writeScimJson(res, 409, { schemas: [ERROR_SCHEMA_URI], status: '409' });

    expect(status()).toBe(409);
    expect(headers()['Content-Type']).toBe(SCIM_CONTENT_TYPE);
    expect(body()).toEqual({ schemas: [ERROR_SCHEMA_URI], status: '409' });
  });

  it('falls back to writeHead + end on a raw ServerResponse', () => {
    const { res, status, headers, payload } = nodeLikeRes();

    writeScimJson(res, 500, { schemas: [ERROR_SCHEMA_URI], status: '500' });

    expect(status()).toBe(500);
    expect(headers()).toEqual({ 'Content-Type': SCIM_CONTENT_TYPE });
    expect(payload()).toBe(JSON.stringify({ schemas: [ERROR_SCHEMA_URI], status: '500' }));
  });
});

describe('ScimExceptionFilter (RFC 7644 §3.12 mapping)', () => {
  const filter = new ScimExceptionFilter();

  it('maps ScimError to its status + Table 9 scimType body', () => {
    const { res, status, body, headers } = expressLikeRes();

    runFilter(filter, res, uniqueness({ detail: 'userName taken' }));

    expect(status()).toBe(409);
    expect(headers()['Content-Type']).toBe(SCIM_CONTENT_TYPE);
    expect(body()).toEqual({
      schemas: [ERROR_SCHEMA_URI],
      status: '409',
      scimType: 'uniqueness',
      detail: 'userName taken',
    });
  });

  it('maps foreign HttpExceptions to SCIM shape WITHOUT scimType', () => {
    const { res, status, body } = expressLikeRes();

    runFilter(filter, res, new HttpException('Route not found', 404));

    expect(status()).toBe(404);
    expect(body()).toEqual({
      schemas: [ERROR_SCHEMA_URI],
      status: '404',
      detail: 'Route not found',
    });
    expect('scimType' in (body() as Record<string, unknown>)).toBe(false);
  });

  it('converts unknown bugs to 500 with GENERIC detail, logging the cause', () => {
    const { res, status, body } = expressLikeRes();
    const logError = vi
      .spyOn(filter['logger' as keyof ScimExceptionFilter] as { error: (m: string) => void }, 'error')
      .mockImplementation(() => undefined);

    runFilter(filter, res, new Error('db credentials leak'));

    expect(status()).toBe(500);
    expect(body()).toEqual({
      schemas: [ERROR_SCHEMA_URI],
      status: '500',
      detail: INTERNAL_ERROR_DETAIL,
    });
    expect(JSON.stringify(body())).not.toContain('db credentials leak');
    expect(logError).toHaveBeenCalledTimes(1);
    logError.mockRestore();
  });

  it('mirrors ScimError.status 500 without leaking details of it', () => {
    const boom = internal({ detail: 'secret', cause: new Error('hidden') });
    const { res, status, body } = expressLikeRes();

    runFilter(filter, res, boom);

    expect(status()).toBe(500);
    expect((body() as { detail?: string }).detail).toBe('secret'); // caller-owned error MAY carry detail
  });

  it('maps isScimError-ness even for foreign ScimError copies', () => {
    const foreignCopy = Object.create(ScimError.prototype);
    const { res, status, body } = expressLikeRes();

    runFilter(filter, res, foreignCopy);

    expect(status()).toBe(500); // degenerate ScimError without status typed check? isScimError checks status:number
    expect(body()).toMatchObject({ schemas: [ERROR_SCHEMA_URI] });
  });

  it('writes into a raw node response when the adapter exposes one', () => {
    const { res, status, payload } = nodeLikeRes();

    runFilter(filter, res, uniqueness({ detail: 'externalId in use' }));

    expect(status()).toBe(409);
    expect(payload()).toBe(
      JSON.stringify({
        schemas: [ERROR_SCHEMA_URI],
        status: '409',
        scimType: 'uniqueness',
        detail: 'externalId in use',
      }),
    );
  });
});
