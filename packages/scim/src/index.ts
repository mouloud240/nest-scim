/**
 * @nest-scim/core — SCIM 2.0 User provisioning server library for NestJS.
 *
 * The library owns the protocol (endpoints, RFC 7644 PATCH, filtering,
 * pagination, error taxonomy); the application owns only its data through
 * two DI-wired SPI contracts (a user service + a user mapper).
 *
 * M1: protocol core (framework-free). The Nest module, controller and SPI
 * wiring land in M2 — see docs/SCIM_SPEC.md.
 */

/** Current library version, kept in sync with package.json. */
export const VERSION = '0.0.0-alpha.0' as const;

/* ── Errors — RFC 7644 §3.12 ───────────────────────────────────────────── */
export {
  SCIM_ERROR,
  ScimError,
  isScimError,
} from './core/errors/scim-error';
export type { ScimErrorOptions, ScimScimType } from './core/errors/scim-error';
export {
  invalidFilter,
  tooMany,
  noTarget,
  invalidValue,
  invalidSyntax,
  invalidPath,
  invalidVers,
  sensitive,
  mutability,
  uniqueness,
  notFound,
  internal,
} from './core/errors/factories';
export type { ScimErrorFactoryOptions } from './core/errors/factories';
export { ERROR_SCHEMA_URI, toErrorBody } from './core/errors/body';
export type { ScimErrorResponse } from './core/errors/body';

/* ── Core resource types — RFC 7643 §3.1/§4.1, RFC 7644 §3.4.2/§3.5.1 ──── */
export type { ScimMeta } from './core/types/common';
export {
  SCIM_USER_SCHEMA,
} from './core/types/user';
export type { ScimEmailType, ScimEmail, ScimPhoneType, ScimPhoneNumber, ScimImType, ScimIm, ScimPhotoType, ScimPhoto, ScimAddressType, ScimAddress, ScimGroupReference, ScimEntitlement, ScimX509Certificate, ScimName, ScimUser, ScimUserResource, ScimUserCreate } from './core/types/user';
export {
  PATCH_OP_SCHEMA,
} from './core/types/patch';
export type { PatchOpKind, PatchOperation, PatchRequest } from './core/types/patch';
export {
  LIST_RESPONSE_SCHEMA,
} from './core/types/list';
export type { ScimListResponse, ScimListQuery, Page } from './core/types/list';

/* ── meta / Location — RFC 7643 §3.1 ───────────────────────────────────── */
export {
  locationFor,
  metaFor,
  normalizeBasePath,
  scimDateTime,
  withResourceCommons,
} from './core/meta/meta';
export type { MetaForOptions } from './core/meta/meta';

/* ── ListResponse — RFC 7644 §3.4.2 ────────────────────────────────────── */
export { buildListResponse } from './core/responses/list-response';
export type { ListResponseInput } from './core/responses/list-response';

/* ── /Schemas — RFC 7643 §7/§8.7.1 ─────────────────────────────────────── */
export type {
  ScimAttributeType,
  ScimMutability,
  ScimReturned,
  ScimUniqueness,
  ScimSchemaAttribute,
  ScimSchemaDescriptor,
} from './core/schemas/schema-types';
export { SCIM_USER_SCHEMA_DESCRIPTOR } from './core/schemas/user-schema';

/* ── ServiceProviderConfig — RFC 7643 §5, RFC 7644 §4 ──────────────────── */
export {
  SPC_SCHEMA,
  DEFAULT_SCIM_SERVICE_CONFIG,
} from './core/spc/provider-config';
export type {
  ScimAuthenticationScheme,
  ScimServiceProviderConfig,
  ScimSPPatchSection,
  ScimSPBulkSection,
  ScimSPFilterSection,
  ScimSPChangePasswordSection,
  ScimSPSortSection,
  ScimSPEtagSection,
} from './core/spc/provider-config';
export { buildServiceProviderConfig } from './core/spc/merge-provider-config';
export type { ScimSPCOverrides } from './core/spc/merge-provider-config';
