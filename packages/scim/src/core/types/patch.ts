/**
 * PATCH operation request types — RFC 7644 §3.5.2
 * (docs/rfc/rfc7644.txt §3.5.2: op values add/replace/remove, path with
 * value-filter path grammar per Figure 7; request carried under the
 * `urn:ietf:params:scim:api:messages:2.0:PatchOp` schema with the literal
 * attribute name "Operations" (capital O, §3.5.1)).
 */

/** Schema URN of a PATCH request (RFC 7644 §3.5.2). */
export const PATCH_OP_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp' as const;

/** One of the three RFC 7644 §3.5.2 operation values. */
export type PatchOpKind = 'add' | 'replace' | 'remove';

/**
 * A single operation entry. `path` is RFC 7644 path grammar (attribute
 * names with optional value filters, e.g. `emails[type eq "work"].value`);
 * `value` holds add/replace payloads (array or scalar/complex).
 */
export interface PatchOperation {
  /** Operation value: semantically case-insensitive per §3.5.2 ("Replace"/"replace" both legal). */
  op: PatchOpKind;
  /** Target path (RFC 7644 path grammar, Figure 7). Required for remove; optional for add/replace. */
  path?: string;
  /** Payload for add/replace; forbidden for remove. */
  value?: unknown;
}

/** Body of a PATCH request — literal `Operations` key of §3.5.2. */
export interface PatchRequest {
  schemas: [typeof PATCH_OP_SCHEMA];
  Operations: PatchOperation[];
}
