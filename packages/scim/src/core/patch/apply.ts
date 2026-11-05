/**
 * PATCH application wrapper — the seam between the protocol layer and the
 * `scim-patch` engine (RFC 7644 §3.5.2).
 *
 * - Atomicity (rfc7644.txt line 1931) via `mutateDocument: false`: the engine
 *   deep-clones ONCE up front (scimPatch.js L60–91), then reduces all ops
 *   sequentially on that clone (§3.5.2 lines 1918–1922). A failing op aborts
 *   mid-way; the caller's resource is never touched, nothing is written.
 * - Engine errors → RFC Table 9 ScimErrors (mapPatchEngineError).
 * - Op values normalize case-insensitively (§3.5.2 lines 1810–1812; IdPs send
 *   'ADD'/'Replace').
 *
 * JSON-clone caveat (accepted): engine state is a JSON round-trip — valid
 * because the input is `toScim(domain)` output; commons are rebuilt by the
 * adapter after patching.
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

  // Validate the NORMALIZED value — 'ADD' is legal on the wire.
  const kind = typeof raw.op === 'string' ? raw.op.toLowerCase() : undefined;
  if (kind === undefined || !VALID_OP_KINDS.has(kind as PatchOpKind)) {
    throw invalidSyntax({
      detail: `${where}: "op" must be one of "add", "replace", "remove".`,
    });
  }

  if (typeof raw.path !== 'undefined' && typeof raw.path !== 'string') {
    throw invalidPath({ detail: `${where}: "path" must be a string when present.` });
  }
  if (kind === 'remove' && raw.path === undefined) {
    // §3.5.2.2 line 2140: the path IS the target for remove.
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
 * `treatMissingAsAdd: true` per §3.5.2.3 line 2376 (replace on a missing
 * target SHALL be treated as add) — so engine noTarget escapes only for
 * non-eq comparisons and remove ops.
 */
export function applyPatchOperations<T extends object>(resource: T, operations: PatchOperation[]): T {
  try {
    return scimPatch(resource as unknown as ScimResource, operations as ScimPatchOperation[], {
      mutateDocument: false,
      treatMissingAsAdd: true,
    }) as T;
  } catch (error) {
    throw mapPatchEngineError(error);
  }
}

/** Validate the wire body AND apply it in one step (adapter entry point). */
export function applyPatchRequest<T extends object>(resource: T, rawBody: unknown): T {
  return applyPatchOperations(resource, parsePatchOperations(rawBody));
}

/**
 * scim-patch class hierarchy → RFC Table 9 taxonomy; unrecognized throws
 * degrade to invalidPath (application-time faults are filter/path-shaped).
 *
 * The two valueFilter classes are NOT in the engine's public exports but
 * escape at runtime — discriminated by constructor name (non-minified,
 * named in the d.ts hierarchy).
 */
const NO_TARGET_ENGINE_CLASS_NAMES = new Set(['FilterArrayTargetNotFound', 'FilterOnEmptyArray']);

export function mapPatchEngineError(error: unknown): ScimError {
  if (
    error instanceof NoTarget ||
    (error instanceof Error && NO_TARGET_ENGINE_CLASS_NAMES.has(error.constructor.name))
  ) {
    return noTarget({ cause: error });
  }
  if (error instanceof NoPathInScimPatchOp) {
    return noTarget({ cause: error });
  }
  if (error instanceof InvalidScimPatchOp) {
    return invalidPath({ cause: error }); // malformed op/path shapes
  }
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
  return invalidPath({ detail: 'The specified patch path was invalid or malformed.', cause: error });
}
