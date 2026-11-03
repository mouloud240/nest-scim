/**
 * @nest-scim/core — SCIM 2.0 User provisioning server library for NestJS.
 *
 * The library owns the protocol (endpoints, RFC 7644 PATCH, filtering,
 * pagination, error taxonomy); the application owns only its data through two
 * DI-wired SPI contracts (a user service + a user mapper).
 *
 * M0 scaffold: toolchain smoke-test only. The public API (ScimModule,
 * ScimController, mapper/service SPI) lands in M1/M2 — see docs/SCIM_SPEC.md.
 */

/** Current library version, kept in sync with package.json. */
export const VERSION = '0.0.0-alpha.0' as const;
