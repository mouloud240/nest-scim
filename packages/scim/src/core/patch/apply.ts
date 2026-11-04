/**
 * PATCH application wrapper — the seam between our protocol layer and the
 * `scim-patch` engine (RFC 7644 §3.5.2). Docs/milestones/M3.md T1.
 *
 * Why a wrapper instead of calling `scimPatch` directly from the adapter:
 * - SINGLE-CALL ATOMICITY (verified against the installed lib, scimPatch.js
 *   lines 60–91): with `mutateDocument: false` the engine deep-clones the
 *   resource ONCE up front and runs all operations through a sequential
 *   `reduce` on that clone. A failing op *n* aborts before any later op —
 *   the caller's resource is never touched and the clone is discarded, so
 *   the RFC's atomicity MUST (rfc7644.txt line 1931) holds structurally:
 *   nothing is written because nothing was mutated in place.
 * - Sequential semantics (lines 1918–1922) come from the same reduce: each
 *   op sees the result of the prior one, covering chained ops, implicit
 *   `schemas` growth (lines 1900–1916), and valueFilters resolved against
 *   the patched state.
 * - ERRORS: `scim-patch` throws its own class hierarchy (NoTarget,
 *   InvalidScimPatchOp, …). The RFC's wire taxonomy is Table 9 — we map
 *   library classes onto §3.12 ScimErrors so the exception filter always
 *   speaks wire truth. Note the engine also rethrows raw parse errors for
 *   malformed filter paths (scimPatch.js line 191 `throw e`), mapped to
 *   `invalidPath` ("path attribute was invalid or malformed", Table 9).
 * - ENTRA/OKTA QUIRK: op values are RFC case-insensitive (line 1810–1812
 *   "MAY be one of add, remove, replace") and real IdPs send 'Add',
 *   'REPLACE'… — normalized here before the engine sees them (its type
 *   union only covers first-cap variants).
 *
 * JSON-clone caveat (accepted): the engine's clone is a JSON round-trip,
 * valid because the resource handed to it is `toScim(domain)` output —
 * a wire-shaped plain object. `meta` timestamps are rebuilt by the adapter
 * after patching; the patched object is consumed only by `fromScim`.
 */
import {
  type ScimPatchOperation,
  type ScimResource,
  InvalidScimPatch,
  InvalidScimPatchOp,
  InvalidScimPatchRequest,
  InvalidScimRemoveValue,
  NoPathInScimPatchOp,
  NoTarget,
  RemoveValueNestedArrayNotSupported,
  RemoveValueNotArray,
  scimPatch,
} from 'scim-patch';
import {
  invalidPath,
  invalidSyntax,
  invalidValue,
  noTarget,
} from '../errors/factories';
import { ScimError } from '../errors/scim-error';
import { PATCH_OP_SCHEMA, PatchOpKind, PatchOperation } from '../types/patch';

/**
 * Wire PATCH body → validated, normalized operation list (RFC §3.5.2
 * body MUSTs: `schemas` must include the PatchOp URN — line 1804–1806;
 * `Operations` ≥ 1 — line 1808–1810; `remove` requires `path` — §3.5.2.2).
 * Entra/Okta case quirks normalize here, ONCE, before the engine.
 */
export function parsePatchOperations(rawBody: unknown): PatchOperation[] {
  if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw invalidSyntax({ detail: 'Request body must be a single JSON PATCH object.' });
  }
  const body = rawBody as Record<string, unknown>;
  if (!Array.isArray(body.schemas) || !body.schemas.includes(PATCH_OP_SCHEMA)) {
    throw invalidSyntax({
      detail: `Request body must declare "schemas" including ${PATCH_OP_SCHEMA} (RFC 7644 §3.5.2).`,
    });
  }
  if (!Array.isArray(body.Operations) || body.Operations.length < 1) {
    throw invalidSyntax({
      detail: 'Request body must include an "Operations" array with at least one operation (RFC 7644 §3.5.2).',
    });
  }
  return body.Operations.map((rawOp, index) => normalizePatchOperation(rawOp, index + 1));
}

const VALID_OP_KINDS = new Set<PatchOpKind>(['add', 'replace', 'remove']);

/** One operation entry → typed, case-normalized; structural faults → 400. */
function normalizePatchOperation(rawOp: unknown, opIndex: number): PatchOperation {
  const where = `Operations[${opIndex}]`;
  if (rawOp === null || typeof rawOp !== 'object' || Array.isArray(rawOp)) {
    throw invalidSyntax({ detail: `${where} must be a single JSON operation object.` });
  }
  const raw = rawOp as Record<string, unknown>;

  // RFC line 1810–1812: op value is one of add/remove/replace; IdPs send
  // 'Add'/'REPLACE' (semantic case-insensitivity), so normalize first and
  // validate the normalized value — 'ADD' is legal on the wire.
  const kind = typeof raw.op === 'string' ? raw.op.toLowerCase() : undefined;
  if (kind === undefined || !VALID_OP_KINDS.has(kind as PatchOpKind)) {
    throw invalidSyntax({
      detail: `${where}: "op" must be one of "add", "replace", "remove".`,
    });
  }

  if (typeof raw.path !== 'undefined' && typeof raw.path !== 'string') {
    throw invalidPath({ detail: `${where}: "path" must be a string when present.` });
  }
  // §3.5.2.2 (line 2140): a remove without a target path fails with
  // 400 noTarget — the path IS the target for remove.
  if (kind === 'remove' && raw.path === undefined) {
    throw noTarget({ detail: `${where}: a "remove" operation requires a "path" (RFC 7644 §3.5.2.2).` });
  }

  return {
    op: kind as PatchOpKind,
    path: raw.path as string | undefined,
    value: raw.value,
  };
}

/**
 * Applies a validated operation list to `resource` WITHOUT mutating it and
 * returns the patched copy. Throws ScimError on the first failing op.
 *
 * `treatMissingAsAdd: true` (RFC §3.5.2.3, line 2376 — "replace on a
 * target that does not exist SHALL be treated as an add"): for VALUE-
 * FILTER paths this means a failed `eq` comparison auto-adds the entry,
 * so engine noTarget escapes only for non-eq comparisons and remove ops.
 */
export function applyPatchOperations<T extends object>(resource: T, operations: PatchOperation[]): T {
  try {
    return scimPatch(resource as unknown as ScimResource, operations as ScimPatchOperation[], {
      mutateDocument: false, // atomicity: original stays byte-identical
      treatMissingAsAdd: true, // RFC §3.5.2.3 line 2376: replace on missing → add
    }) as T;
  } catch (error) {
    throw mapPatchEngineError(error);
  }
}

/**
 * Adapter entry point: validate the wire body AND apply it in one step.
 * Uses the real op sequence from the request, normalized by
 * {@link parsePatchOperations}.
 */
export function applyPatchRequest<T extends object>(resource: T, rawBody: unknown): T {
  return applyPatchOperations(resource, parsePatchOperations(rawBody));
}

/**
 * scim-patch class hierarchy → RFC 7644 Table 9 taxonomy. Most specific
 * first; anything unrecognized is treated as a path-shaped fault, because
 * the engine's remaining throws during application are filter/path-shaped.
 *
 * Shape note: `FilterOnEmptyArray` and `FilterArrayTargetNotFound` are
 * real runtime classes but NOT in the package's public export surface
 * (verified: they escape during application). Discriminating by
 * constructor name is the stable seam — the classes are non-minified and
 * named in the d.ts hierarchy. They mean "the valueFilter matched
 * nothing operable" → Table 9 noTarget wording fits.
 */
const NO_TARGET_ENGINE_CLASS_NAMES = new Set(['FilterArrayTargetNotFound', 'FilterOnEmptyArray']);

export function mapPatchEngineError(error: unknown): ScimError {
  // noTarget — path did not yield an operable attribute/value (§3.5.2.2:
  // "400 and a scimType error code of noTarget").
  if (
    error instanceof NoTarget ||
    (error instanceof Error && NO_TARGET_ENGINE_CLASS_NAMES.has(error.constructor.name))
  ) {
    return noTarget({ cause: error });
  }
  if (error instanceof NoPathInScimPatchOp) {
    return noTarget({ cause: error }); // remove without a viable target
  }
  // Malformed op/path shapes, including raw malformed filter syntax the
  // engine rejects with InvalidScimPatchOp ("this part of the path … is
  // invalid") → Table 9 invalidPath wording fits.
  if (error instanceof InvalidScimPatchOp) {
    return invalidPath({ cause: error });
  }
  // Remove "value" misuse (not an array, nested arrays…) — value-shaped.
  if (
    error instanceof InvalidScimRemoveValue ||
    error instanceof RemoveValueNotArray ||
    error instanceof RemoveValueNestedArrayNotSupported
  ) {
    return invalidValue({ cause: error });
  }
  if (error instanceof InvalidScimPatchRequest || error instanceof InvalidScimPatch) {
    return invalidSyntax({ cause: error });
  }
  // Anything else while applying — request-induced path/shape fault
  // (malformed filter grammar, navigation into scalars…).
  return invalidPath({ detail: 'The specified patch path was invalid or malformed.', cause: error });
}
