/**
 * Convenience constructors for every defined SCIM detail error —
 * RFC 7644 §3.12, Table 9 (docs/rfc/rfc7644.txt lines 3819–3909).
 *
 * Keyword set verbatim: invalidFilter, tooMany, uniqueness, mutability,
 * invalidSyntax, invalidPath, noTarget, invalidValue, invalidVers, sensitive.
 * All Table 9 rows apply to HTTP 400 except `uniqueness` (409).
 *
 * Statuses without a Table 9 keyword (404 Not Found, 500 Internal Server
 * Error) produce errors with no `scimType` — the attribute is OPTIONAL.
 */

import { ScimError, ScimScimType } from './scim-error';

/** Options shared by every factory: detail message + underlying cause. */
export interface ScimErrorFactoryOptions {
  detail?: string;
  cause?: unknown;
}

function make(
  status: number,
  scimType: ScimScimType,
  fallback: string,
  { detail, cause }: ScimErrorFactoryOptions = {},
): ScimError {
  return new ScimError({ status, scimType, detail: detail ?? fallback, cause });
}

/* ── Table 9: 400 keywords ─────────────────────────────────────────────── */

/** §3.4.2/§3.4.3/§3.5.2 — filter syntax invalid or unsupported combination. */
export const invalidFilter = (options: ScimErrorFactoryOptions = {}) =>
  make(400, 'invalidFilter', 'The specified filter syntax was invalid, or the attribute and comparison combination is not supported.', options);

/** §3.4.2/§3.4.3 — filter yields too many results to process. */
export const tooMany = (options: ScimErrorFactoryOptions = {}) =>
  make(400, 'tooMany', 'The specified filter yields too many results to be processed.', options);

/** §3.5.2 — PATCH path did not match any attribute or value. */
export const noTarget = (options: ScimErrorFactoryOptions = {}) =>
  make(400, 'noTarget', 'The specified path did not yield an attribute or value that could be operated on.', options);

/** §3.3/§3.4.2/§3.5.1/§3.5.2 — missing or incompatible value. */
export const invalidValue = (options: ScimErrorFactoryOptions = {}) =>
  make(400, 'invalidValue', 'A required value was missing, or the specified value is not compatible with the operation or attribute type.', options);

/** §3.3/§3.4.3/§3.5.1 — request body structure invalid. */
export const invalidSyntax = (options: ScimErrorFactoryOptions = {}) =>
  make(400, 'invalidSyntax', 'The request body message structure was invalid or did not conform to the request schema.', options);

/** §3.5.2 — PATCH path invalid or malformed. */
export const invalidPath = (options: ScimErrorFactoryOptions = {}) =>
  make(400, 'invalidPath', 'The specified path attribute was invalid or malformed.', options);

/** §3.13 — unsupported SCIM protocol version header. */
export const invalidVers = (options: ScimErrorFactoryOptions = {}) =>
  make(400, 'invalidVers', 'The specified SCIM protocol version is not supported.', options);

/** §7.5.2 (RFC 7643) — sensitive information passed in a request URI. */
export const sensitive = (options: ScimErrorFactoryOptions = {}) =>
  make(400, 'sensitive', 'The request cannot be completed because it carries sensitive information in the request URI.', options);

/** Non-Table-9 keyword: PUT/PATCH mutability/state conflict (§3.5.1/§3.5.2). */
export const mutability = (options: ScimErrorFactoryOptions = {}) =>
  make(400, 'mutability', 'The attempted modification is not compatible with the target attribute mutability or current state.', options);

/* ── Other statuses ────────────────────────────────────────────────────── */

/** §3.3/§3.5.1/§3.5.2 — duplicate attribute values already in use (409). */
export const uniqueness = (options: ScimErrorFactoryOptions = {}) =>
  make(409, 'uniqueness', 'One or more of the attribute values are already in use or are reserved.', options);

/** Resource or endpoint does not exist — 404 with NO scimType (Table 9 has none). */
export const notFound = (options: ScimErrorFactoryOptions = {}) =>
  new ScimError({ status: 404, detail: options.detail, cause: options.cause });

/** Uncaught application failure — 500 with NO scimType. */
export const internal = (options: ScimErrorFactoryOptions = {}) =>
  new ScimError({ status: 500, detail: options.detail, cause: options.cause });
