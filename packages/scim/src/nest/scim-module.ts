/**
 * ScimModule — the one dynamic module an application wires in:
 *
 * ```ts
 * @Module({ imports: [ScimModule.forRoot({ basePath: '/scim', … })] })
 * export class AppModule {}
 * ```
 *
 * Design choices locked in docs/SCIM_SPEC.md (M2):
 * - Control base path + conditional guards live INSIDE forRoot ⇒ dynamic
 *   controller classes built in this closure (no RouterModule peer dep).
 * - Library writes responses through the adapter-agnostic writer in
 *   `scim-content.ts` (express AND fastify AND raw node surfaces).
 * - `/Users` routes carry the user's `Option.auth` guards ONLY;
 *   discovery endpoints stay unguarded by default (rate limiting and
 *   global locking are bootstrap concerns of the application).
 * - PATCH route registered NOW, answering 501 per RFC 7644 Table 8
 *   ("does not support the request operation, e.g., PATCH") until M3.
 */
import {
  Body,
  CanActivate,
  Controller,
  Delete,
  DynamicModule,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Provider,
  Put,
  Query,
  Res,
  Type,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { buildServiceProviderConfig } from '../core/spc/merge-provider-config';
import type { ScimServiceProviderConfig } from '../core/spc/provider-config';
import { buildListResponse } from '../core/responses/list-response';
import { normalizeBasePath } from '../core/meta/meta';
import { SCIM_USER_SCHEMA_DESCRIPTOR } from '../core/schemas/user-schema';
import type { ScimSchemaDescriptor } from '../core/schemas/schema-types';
import { notFound, notImplemented } from '../core/errors/factories';
import { setLocationHeader, writeScimJson } from './scim-content';
import { ScimExceptionFilter } from './scim-exception.filter';
import {
  ParsedListQuery,
  ScimUserAdapter,
} from './scim-user-adapter';
import { ScimListQueryPipe } from './scim-list-query.pipe';
import { SCIM_USER_MAPPER, SCIM_USER_SERVICE } from './tokens';
import type { ScimModuleOptions } from './scim-module-options';

/** Error emitted when forRoot receives a broken options shape. */
class ScimModuleConfigError extends Error {
  constructor(public readonly field: string, what: string) {
    super(`ScimModule.forRoot: ${field} must be ${what}.`);
    this.name = 'ScimModuleConfigError';
  }
}

/** Concatenates base path + resource suffix without doubled slashes. */
function joinResourcePath(basePath: string, suffix: string): string {
  const base = normalizeBasePath(basePath);
  return base === '/' ? `/${suffix}` : `${base}/${suffix}`;
}

function asClass(value: unknown, field: string): Type<unknown> {
  if (typeof value !== 'function' || value.prototype === undefined) {
    throw new ScimModuleConfigError(field, 'a class reference');
  }
  return value as Type<unknown>;
}

function asGuardList(auth: ScimModuleOptions['auth']): Array<Type<CanActivate>> {
  if (auth === undefined) return [];
  return Array.isArray(auth) ? [...auth] : [auth];
}

/** Raw HTTP response surface tolerated by the controller layer. */
type ControllerResponse = unknown;

/**
 * `/Users` routes — CRUD against the adapter; every response is written
 * manually through {@link writeScimJson} (platform-agnostic, and always
 * the RFC media type), which is why no `@Header` decorators appear here.
 */
function createUsersControllerClass(
  basePath: string,
  guards: Array<Type<CanActivate>>,
): Type<unknown> {
  @Controller(joinResourcePath(basePath, 'Users'))
  @UseFilters(new ScimExceptionFilter())
  class ScimUsersController {
    constructor(
      @Inject(ScimUserAdapter)
      private readonly adapter: ScimUserAdapter<unknown>,
    ) {}

    @Get()
    async list(
      @Res() res: ControllerResponse,
      @Query(ScimListQueryPipe) query: ParsedListQuery,
    ): Promise<void> {
      writeScimJson(res, 200, await this.adapter.list(query));
    }

    @Get(':id')
    async detail(
      @Param('id') id: string,
      @Res() res: ControllerResponse,
      @Query(ScimListQueryPipe) query: ParsedListQuery,
    ): Promise<void> {
      const result = await this.adapter.detail(id, query);
      writeScimJson(res, 200, result.resource);
    }

    @Post()
    async create(
      @Body() payload: unknown,
      @Res() res: ControllerResponse,
    ): Promise<void> {
      const result = await this.adapter.create(payload);
      setLocationHeader(res, result.location); // §3.3: Location header
      writeScimJson(res, 201, result.resource);
    }

    @Put(':id')
    async replace(
      @Param('id') id: string,
      @Body() payload: unknown,
      @Res() res: ControllerResponse,
    ): Promise<void> {
      const result = await this.adapter.replace(id, payload);
      writeScimJson(res, 200, result.resource);
    }

    @Patch(':id')
    patch(): void {
      // RFC 7644 Table 8: 501 = "service provider does not support the
      // request operation, e.g., PATCH". Handler swaps in at M3.
      throw notImplemented({ detail: 'PATCH is not supported by this service provider yet.' });
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @Res() res: ControllerResponse): Promise<void> {
      await this.adapter.deleteResource(id);
      writeScimJson(res, 204); // §3.5.3: successful DELETE → 204, no body
    }
  }

  if (guards.length > 0) UseGuards(...guards)(ScimUsersController);
  return ScimUsersController;
}

/** Discovery routes — unguarded by default (SCIM_SPEC D11). */
function createDiscoveryControllerClass(
  basePath: string,
  providerConfig: ScimServiceProviderConfig,
): Type<unknown> {
  const knownSchemas = [SCIM_USER_SCHEMA_DESCRIPTOR] as const;

  @Controller(basePath)
  @UseFilters(new ScimExceptionFilter())
  class ScimDiscoveryController {
    @Get('ServiceProviderConfig')
    serviceProviderConfig(@Res() res: ControllerResponse): void {
      writeScimJson(res, 200, providerConfig);
    }

    @Get('Schemas')
    schemas(@Res() res: ControllerResponse): void {
      // RFC 7644 §4: /Schemas returns a ListResponse of schema resources.
      writeScimJson(res, 200, buildListResponse<ScimSchemaDescriptor>({
        totalResults: knownSchemas.length,
        items: [...knownSchemas],
      }));
    }

    @Get('Schemas/:schemaId')
    schema(@Param('schemaId') schemaId: string, @Res() res: ControllerResponse): void {
      // §4: an individual schema is returned AS the resource (no envelope).
      // Ids are URNs; the URL path may be attenuated by percent encoding.
      const requested = decodeURIComponent(schemaId);
      const schema = knownSchemas.find((s) => s.id === requested)
        ?? knownSchemas.find((s) => s.id.endsWith(`:${requested}`));
      if (schema === undefined) {
        throw notFound({ detail: `Schema ${schemaId} not found.` });
      }
      writeScimJson(res, 200, schema);
    }
  }

  return ScimDiscoveryController;
}

export class ScimModule {
  /**
   * Registers:
   * - `SCIM_USER_SERVICE`  → `options.userService` class
   * - `SCIM_USER_MAPPER`   → `options.userMapper` class
   * - `ScimUserAdapter`    → factory over the two tokens
   * - Users + discovery controllers under the configured base path
   *
   * Fails LOUDLY at bootstrap (ScimModuleConfigError) instead of 500ing
   * inside a request when options are malformed.
   */
  static forRoot(options: ScimModuleOptions): DynamicModule {
    if (options === null || typeof options !== 'object') {
      throw new ScimModuleConfigError('options', 'an object');
    }
    const basePathRaw = options.basePath ?? '';
    const basePath = typeof basePathRaw === 'string' ? normalizeBasePath(basePathRaw) : (() => {
      throw new ScimModuleConfigError('basePath', 'a string');
    })();
    const userServiceClass = asClass(options.userService, 'userService');
    const userMapperClass = asClass(options.userMapper, 'userMapper');
    const guards = asGuardList(options.auth);

    const providerConfig = buildServiceProviderConfig(options.serviceProviderConfig ?? {});

    const providerDefs: Provider[] = [
      { provide: SCIM_USER_SERVICE, useClass: userServiceClass },
      { provide: SCIM_USER_MAPPER, useClass: userMapperClass },
      {
        provide: ScimUserAdapter,
        inject: [SCIM_USER_SERVICE, SCIM_USER_MAPPER],
        useFactory: (userService: unknown, userMapper: unknown) =>
          new ScimUserAdapter({
            userService: userService as never,
            userMapper: userMapper as never,
            basePath,
            maxResultsPerPage: providerConfig.filter.maxResults,
          }),
      },
      ...(options.providers ?? []),
    ];

    const controllers = [
      createUsersControllerClass(basePath, guards),
      createDiscoveryControllerClass(basePath, providerConfig),
    ];

    return {
      module: ScimModule,
      imports: options.imports ?? [],
      providers: providerDefs,
      controllers,
      exports: [SCIM_USER_SERVICE, SCIM_USER_MAPPER],
    };
  }
}
