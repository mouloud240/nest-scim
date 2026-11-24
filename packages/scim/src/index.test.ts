import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  VERSION,
  // M2 nest surface — proves every planned consumer import is wired
  ScimModule,
  SCIM_USER_SERVICE,
  SCIM_USER_MAPPER,
  ScimUserMapperToken,
  ScimUserAdapter,
  ScimExceptionFilter,
  SCIM_CONTENT_TYPE,
  writeScimJson,
  setLocationHeader,
  notImplemented,
  projectScimResource,
  ScimListQueryPipe,
  parseScimFilter,
  // M3 patch surface
  applyPatchRequest,
  applyPatchOperations,
  parsePatchOperations,
  mapPatchEngineError,
  PATCH_OP_SCHEMA,
} from './index';
import * as scim from './index';
import type {
  ScimModuleOptions,
  ScimUserService,
  ScimUserMapper,
  ScimUserMeta,
  DomainFilter,
  AttributePathMap,
} from './index';

describe('toolchain smoke test', () => {
  it('loads the library entry point and exposes VERSION', () => {
    expect(VERSION).toBe('0.0.0-alpha.0');
  });
});

describe('M2 nest exports are wired', () => {
  it('exposes the module, tokens, decorator, adapter, filter and writer', () => {
    expect(typeof ScimModule.forRoot).toBe('function');
    expect(SCIM_USER_SERVICE).toBe(Symbol.for('nest-scim.user-service'));
    expect(SCIM_USER_MAPPER).toBe(Symbol.for('nest-scim.user-mapper'));
    expect(typeof ScimUserMapperToken).toBe('function');
    expect(typeof ScimUserAdapter).toBe('function');
    expect(typeof ScimExceptionFilter).toBe('function');
    expect(typeof ScimListQueryPipe).toBe('function');
    expect(SCIM_CONTENT_TYPE).toBe('application/scim+json');
    expect(typeof writeScimJson).toBe('function');
    expect(typeof setLocationHeader).toBe('function');
  });

  it('re-exports the RFC-mandated error factory and projection helper', () => {
    expect(notImplemented().status).toBe(501);
    expect(projectScimResource({ id: 'a', schemas: ['s'] }, {})).toEqual({ id: 'a', schemas: ['s'] });
  });

  it('exposes the M3 patch application surface', () => {
    expect(typeof applyPatchRequest).toBe('function');
    expect(typeof applyPatchOperations).toBe('function');
    expect(typeof parsePatchOperations).toBe('function');
    expect(typeof mapPatchEngineError).toBe('function');
    expect(PATCH_OP_SCHEMA).toBe('urn:ietf:params:scim:api:messages:2.0:PatchOp');

    const patched = applyPatchRequest(
      { schemas: ['s'], userName: 'a' } as unknown as object,
      { schemas: [PATCH_OP_SCHEMA], Operations: [{ op: 'Replace', path: 'userName', value: 'b' }] },
    );
    expect((patched as { userName?: string }).userName).toBe('b'); // case-normalized end-to-end
  });

  it('exposes the SPI option/contract type surface at compile time', () => {
    expectTypeOf<ScimModuleOptions>().not.toBeNever();
    expectTypeOf<ScimUserService<never>>(
      {} as unknown as ScimUserService<never>,
    ).not.toBeUndefined();
    expectTypeOf<ScimUserMapper<never>>(
      {} as unknown as ScimUserMapper<never>,
    ).not.toBeUndefined();

    const meta: ScimUserMeta = { version: 'W/"1"' };
    expect(meta.version).toBe('W/"1"');

    const opts: ScimModuleOptions = {
      basePath: '/scim',
      userService: class {},
      userMapper: class {},
    };
    expect(opts.basePath).toBe('/scim');
  });
});

describe('M5 filter exports are wired', () => {
  it('exposes the domain filter contract and attribute path map types', () => {
    expectTypeOf<DomainFilter>().not.toBeNever();
    expectTypeOf<AttributePathMap>().toEqualTypeOf<Readonly<Record<string, string>>>();
  });

  it('keeps the parser exported and drops the in-memory evaluator', () => {
    expect(typeof parseScimFilter).toBe('function');
    expect('matches' in scim).toBe(false);
  });
});
