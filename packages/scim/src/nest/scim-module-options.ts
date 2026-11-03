/**
 * `ScimModule.forRoot()` options.
 *
 * The application provides exactly two SPI classes — a user service (data
 * ownership: lookup/store, RFC 7644 §1 "service provider's responsibility")
 * and a user mapper (domain ⇄ SCIM attribute translation). Everything else —
 * endpoints, wire validation, error taxonomy, meta/Location, pagination —
 * is this library's job.
 */
import type { CanActivate, DynamicModule, ForwardReference, Provider, Type } from '@nestjs/common';
import type { ScimSPCOverrides } from '../core/spc/merge-provider-config';

/** Anything a Nest dynamic module accepts in `imports`. */
export type ModuleImport = Type<unknown> | DynamicModule | ForwardReference<unknown>;

/**
 * Every value must be provided for `forRoot()` to succeed — fail loudly at
 * bootstrap instead of 500ing inside a request handler.
 */
export interface ScimModuleOptions {
  /**
   * Base path under which the SCIM endpoints mount, e.g. `/scim/v2`.
   * The Users routes mount at `${basePath}/Users`; discovery at
   * `${basePath}/ServiceProviderConfig` and `${basePath}/Schemas`.
   * Root-level SCIM ('' or '/') is supported.
   */
  basePath: string;

  /**
   * Class implementing the {@link `ScimUserService`} SPI. Registered under
   * the `SCIM_USER_SERVICE` token; its own `@Inject` dependencies must be
   * importable in the current context — use `imports`/`providers` below.
   */
  userService: Type<unknown>;

  /**
   * Class implementing the {@link `ScimUserMapper`} SPI, registered under
   * the `SCIM_USER_MAPPER` token. Recommended (but not required) to also
   * tag it with `@ScimUserMapperToken()`.
   */
  userMapper: Type<unknown>;

  /**
   * Nest guards protecting the `/Users` routes ONLY. Discovery endpoints
   * (`/ServiceProviderConfig`, `/Schemas`) stay unguarded — IdPs typically
   * fetch them before authenticating; apply a global guard at bootstrap if
   * your setup requires locking them (rate limiting stays your throttler's
   * job, wired at bootstrap like any other Nest middleware).
   */
  auth?: Type<CanActivate> | Array<Type<CanActivate>>;

  /** Optional service provider config knobs (RFC 7643 §5 overrides). */
  serviceProviderConfig?: ScimSPCOverrides;

  /**
   * Passthroughs for the dependencies of your SPI classes — forwarded
   * unchanged onto the generated dynamic module.
   */
  imports?: ModuleImport[];
  providers?: Provider[];
}
