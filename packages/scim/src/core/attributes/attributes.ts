/**
 * Attribute selection projection — RFC 7644 §3.9 + §3.10
 * (docs/rfc/rfc7644.txt lines 3571–3665):
 * - `attributes` / `excludedAttributes` are MUTUALLY EXCLUSIVE,
 * - the minimum set (`schemas`, `id`, "always"-returned attrs) is ALWAYS
 *   present; `attributes` overrides the default set,
 * - names are case-INSENSITIVE (§3.10) and MAY be URN-prefixed or dotted,
 * - value-filter notation (`emails[type eq "work"]`) is NOT supported →
 *   rejected as `invalidFilter`.
 */
import { invalidFilter, invalidValue } from '../errors/factories';

/** Query-string attribute selection as received from the HTTP layer. */
export interface ScimAttributeSelection {
  /** §3.9 "attributes" param (comma string pre-split by the controller). */
  attributes?: string[];
  /** §3.9 "excludedAttributes" param. */
  excludedAttributes?: string[];
}

/** URN prefixes recognized for core-schema stripping (§3.10). */
const CORE_URN_PREFIXES = [
  'urn:ietf:params:scim:schemas:core:2.0:User',
  'urn:ietf:params:scim:schemas:core:2.0',
] as const;

/** Always present in projected resources: `schemas` + `id` (§3.9 example). */
const MINIMUM_ATTRS = ['schemas', 'id'] as const;

function throwIfSelectionAmbiguous(selection: ScimAttributeSelection): void {
  if (
    (selection.attributes?.length ?? 0) > 0 &&
    (selection.excludedAttributes?.length ?? 0) > 0
  ) {
    throw invalidValue({
      detail: 'The "attributes" and "excludedAttributes" parameters are mutually exclusive (RFC 7644 §3.9).',
    });
  }
}

/**
 * Splits a raw attribute name into a case-normalized path, stripping
 * core URN prefixes (or reducing an unknown extension URN to its handle)
 * per §3.10. Rejects value-filter paths.
 */
export function splitAttributePath(raw: string): string[] {
  let name = raw.trim();
  for (const prefix of CORE_URN_PREFIXES) {
    const joint = `${prefix}:`;
    if (name.toLowerCase().startsWith(joint.toLowerCase())) {
      name = name.slice(joint.length);
      break;
    }
  }
  if (/^urn:/i.test(name)) name = name.split(':').pop() ?? name;

  const path = name
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (path.some((segment) => segment.includes('['))) {
    throw invalidFilter({
      detail: 'Value filters are not supported inside attribute selection paths (RFC 7644 §3.9/§3.10).',
    });
  }
  if (path.length === 0) {
    throw invalidFilter({ detail: 'Empty attribute name in selection.' });
  }
  return path;
}

/** Case-insensitive key lookup (§3.10: attribute names are case insensitive). */
function lookupCaseInsensitive(obj: Record<string, unknown>, key: string): string | undefined {
  const lower = key.toLowerCase();
  return Object.keys(obj).find((k) => k.toLowerCase() === lower);
}

/** Reads a (possibly dotted, array-aware) path out of a resource value. */
export function selectAttributePath(value: unknown, path: string[]): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((element) => selectAttributePath(element, path))
      .filter((item) => item !== undefined && item !== null);
  }
  const [head, ...tail] = path;
  const realKey = lookupCaseInsensitive(value as Record<string, unknown>, head);
  if (realKey === undefined) return undefined;
  const child = (value as Record<string, unknown>)[realKey];
  if (tail.length === 0) return child;
  return selectAttributePath(child, tail);
}

/**
 * Restricts a value to ONE attribute path, mirroring the value's shape.
 * Returns a keyed object ({ [realKey]: … }) at EVERY level — arrays map
 * element-wise and self-omit when every element projects to nothing
 * (empty result == attribute absent, §3.9). `undefined` ⇒ not present.
 */
function projectPath(value: unknown, path: string[]): Record<string, unknown> | Array<Record<string, unknown>> | undefined {
  if (Array.isArray(value)) {
    const mapped = value
      .map((element) => projectPath(element, path))
      .filter((item): item is Record<string, unknown> => item !== undefined);
    return mapped.length > 0 ? mapped : undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;

  const [head, ...tail] = path;
  const realKey = lookupCaseInsensitive(value as Record<string, unknown>, head);
  if (realKey === undefined) return undefined;
  const child = (value as Record<string, unknown>)[realKey];

  const inner = tail.length > 0 ? projectPath(child, tail) : child;
  if (inner === undefined) return undefined;
  return { [realKey]: inner };
}

/**
 * Projects a returned resource through an attribute selection.
 *
 * Both modes always emit {@link MINIMUM_ATTRS}; `attributes` mode keeps
 * ONLY requested paths on top of the minimum; excluded mode deep-deletes
 * the requested paths (deleting the top-level key entirely). Unknown
 * attribute names are skipped — the resource cannot contain them.
 */
export function projectScimResource<R extends object>(
  resource: R,
  selection: ScimAttributeSelection,
): R {
  throwIfSelectionAmbiguous(selection);

  const attributes = selection.attributes?.length
    ? selection.attributes
    : undefined;
  const excluded = !attributes && selection.excludedAttributes?.length
    ? selection.excludedAttributes
    : undefined;

  if (attributes === undefined && excluded === undefined) return resource;

  const source = resource as unknown as Record<string, unknown>;

  if (attributes !== undefined) {
    const projected: Record<string, unknown> = {};
    for (const key of MINIMUM_ATTRS) {
      if (key in source) projected[key] = source[key];
    }
    for (const requested of attributes) {
      const path = splitAttributePath(requested);
      const value = projectPath(source, path);
      if (value === undefined) continue;
      Object.assign(projected, value);
    }
    return projected as unknown as R;
  }

  const reduced = JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
  for (const excludedName of excluded!) {
    const path = splitAttributePath(excludedName);
    const [head] = path;
    if (MINIMUM_ATTRS.some((min) => min.toLowerCase() === head.toLowerCase())) continue;
    let node: Record<string, unknown> | undefined = reduced;
    for (let i = 0; i < path.length - 1 && node !== undefined; i++) {
      const realKey = lookupCaseInsensitive(node, path[i]);
      node = realKey === undefined ? undefined : (node[realKey] as Record<string, unknown> | undefined);
    }
    if (node !== undefined && typeof node === 'object' && node !== null) {
      const realKey = lookupCaseInsensitive(node, path[path.length - 1]);
      if (realKey !== undefined) delete node[realKey];
    }
  }
  return reduced as unknown as R;
}

