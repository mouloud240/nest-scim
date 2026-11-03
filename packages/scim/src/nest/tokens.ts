/**
 * DI tokens for the SCIM resource SPI.
 *
 * `Symbol.for` (not `Symbol`) mirrors the M1 `SCIM_ERROR` decision: if a
 * consumer's dependency graph accidentally contains two runtime copies of
 * `@nest-scim/core`, both copies register/inject under the same registry
 * key, so `@Inject(SCIM_USER_SERVICE)` keeps resolving to the provider
 * the `ScimModule.forRoot()` of *either* copy registered.
 */
export const SCIM_USER_SERVICE: unique symbol = Symbol.for('nest-scim.user-service');
export const SCIM_USER_MAPPER: unique symbol = Symbol.for('nest-scim.user-mapper');
