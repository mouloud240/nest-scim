/**
 * Structural validation for {@link ScimUserMapper.attributePathMap}.
 * Runs at adapter construction (Nest bootstrap): malformed maps fail loudly
 * instead of surfacing as confusing filter rejections at request time.
 * Semantic validation is impossible here — the domain side is the app's.
 */
import type { AttributePathMap } from './spi';
import { ScimModuleConfigError } from './scim-config-error';

/** Dot-path segment: attribute names and domain fields share this shape. */
const SEGMENT = /^[A-Za-z0-9_$-]+$/;

const FIELD = 'userMapper.attributePathMap';

function assertDotPath(path: string, what: string): void {
  if (path.length === 0 || path.split('.').some((segment) => !SEGMENT.test(segment))) {
    throw new ScimModuleConfigError(FIELD, `a map of ${what} dot-paths`);
  }
}

export function assertAttributePathMap(map: unknown): asserts map is AttributePathMap {
  if (map === null || typeof map !== 'object' || Array.isArray(map)) {
    throw new ScimModuleConfigError(FIELD, 'an object mapping SCIM attrPaths to domain dot-paths');
  }

  const seen = new Set<string>();
  for (const [scimPath, domainPath] of Object.entries(map)) {
    if (typeof domainPath !== 'string') {
      throw new ScimModuleConfigError(FIELD, 'an object mapping SCIM attrPaths to domain dot-paths');
    }
    if (scimPath.includes(':')) {
      throw new ScimModuleConfigError(
        FIELD,
        'keyed by core-relative attrPaths (schema URNs are not supported)',
      );
    }
    assertDotPath(scimPath, 'SCIM attrPath');
    assertDotPath(domainPath, 'domain');

    const key = scimPath.toLowerCase();
    if (seen.has(key)) {
      throw new ScimModuleConfigError(FIELD, `free of duplicate keys (case-insensitive: "${scimPath}")`);
    }
    seen.add(key);
  }
}
