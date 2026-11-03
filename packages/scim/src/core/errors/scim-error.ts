/**
 * SCIM error handling primitives — RFC 7644 §3.12
 * (docs/rfc/rfc7644.txt §3.12: Table 8 status-code usage, Table 9 detail
 * error keywords; ErrorResponse attributes: status=REQUIRED string,
 * scimType=OPTIONAL, detail=OPTIONAL).
 */

/**
 * Registry-backed identity marker for `ScimError`.
 *
 * `Symbol.for` (not `Symbol`) so that runtime copies of this class — e.g. a
 * consumer accidentally running two copies of `@nest-scim/core` — still share
 * one identity for type-guarding (see {@link isScimError}).
 */
export const SCIM_ERROR: unique symbol = Symbol.for('nest-scim.error');

/**
 * SCIM detail error keywords — RFC 7644 §3.12, Table 9, verbatim.
 *
 * All are applicable to 400 responses except `uniqueness` (409). No
 * keywords exist for 404/413/500 responses: their `scimType` is omitted
 * (the attribute is OPTIONAL by §3.12).
 */
export type ScimScimType =
  | 'invalidFilter'
  | 'tooMany'
  | 'uniqueness'
  | 'mutability'
  | 'invalidSyntax'
  | 'invalidPath'
  | 'noTarget'
  | 'invalidValue'
  | 'invalidVers'
  | 'sensitive';

/** Options for constructing a {@link ScimError}. */
export interface ScimErrorOptions {
  /** HTTP status code of the error response (Table 8 usage). */
  status: number;
  /** Table 9 keyword. Omit for statuses with no defined keyword (404, 500, …). */
  scimType?: ScimScimType;
  /** Human-readable detail; doubles as the `message`. */
  detail?: string;
  /** Underlying error preserved via `Error.cause`. */
  cause?: unknown;
}

/**
 * A SCIM-protocol error carrying everything needed to render the RFC 7644
 * §3.12 ErrorResponse body ({@link toErrorBody} in the factories module).
 */
export class ScimError extends Error {
  readonly [SCIM_ERROR]: true = true;

  /** HTTP status code (Table 8 of RFC 7644 §3.12). */
  readonly status: number;

  /** Table 9 keyword, or undefined when the status has none (e.g. 404/500). */
  readonly scimType?: ScimScimType;

  /** Human-readable detail reported in the response body. */
  readonly detail?: string;

  constructor({ status, scimType, detail, cause }: ScimErrorOptions) {
    super(detail ?? `SCIM error (HTTP ${status})`, cause ? { cause } : undefined);
    this.name = 'ScimError';
    this.status = status;
    if (scimType !== undefined) this.scimType = scimType;
    if (detail !== undefined) this.detail = detail;
  }
}

/**
 * Type-guard tolerant of duplicate library copies: recognizes any object
 * created by *any* runtime copy of `ScimError` via the registry symbol.
 */
export function isScimError(err: unknown): err is ScimError {
  return (
    err instanceof Error &&
    SCIM_ERROR in err &&
    typeof (err as { status?: unknown }).status === 'number'
  );
}
