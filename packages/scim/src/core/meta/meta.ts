/**
 * Server-managed common attribute utilities — RFC 7643 §3.1
 * (docs/rfc/rfc7643.txt §3.1: `meta` complex attribute; date-time format
 * per §2.3.1, e.g. 2010-01-23T04:56:22Z, second precision, 'Z' zone).
 */

import { ScimMeta } from '../types/common';

/** Collapses multi slashes and strips the trailing slash from a base path. */
export function normalizeBasePath(basePath: string): string {
  return basePath.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

/**
 * Builds a resource location URI, e.g. `${basePath}/Users/${id}`.
 * The id is percent-encoded so ids containing `/` or `:` cannot escape
 * their path segment.
 */
export function locationFor(basePath: string, resourceType: string, id: string): string {
  return `${normalizeBasePath(basePath)}/${resourceType}/${encodeURIComponent(id)}`;
}

/** Formats a date as SCIM date-time — ISO 8601, second precision, 'Z' zone (§2.3.1). */
export function scimDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Options for building the meta complex attribute. */
export interface MetaForOptions {
  /** Resource type name, e.g. "User". */
  resourceType: string;
  /** Fully-qualified location URI, e.g. from {@link locationFor}. */
  location: string;
  /**
   * Creation instant. OPTIONAL: leave undefined when the store does not
   * track timestamps — `created`/`lastModified` then stay omitted rather
   * than fabricated (RFC 7643 §3.1 meta attributes are OPTIONAL).
   */
  created?: Date;
  /** Last modification instant; defaults to `created` when given. */
  lastModified?: Date;
  /** Version token, exposed to clients as `meta.version`. */
  version?: string;
}

/** Builds the `meta` attribute (RFC 7643 §3.1). */
export function metaFor({
  resourceType,
  location,
  created,
  lastModified,
  version,
}: MetaForOptions): ScimMeta {
  const meta: ScimMeta = {
    resourceType,
    location,
  };
  if (created !== undefined) {
    meta.created = scimDateTime(created);
    meta.lastModified = scimDateTime(lastModified ?? created);
  }
  if (version !== undefined) meta.version = version;
  return meta;
}

/** Attaches server-managed common attributes (`id`, `meta`) to a core resource. */
export function withResourceCommons<T extends object>(
  core: T,
  options: { id: string; meta: ScimMeta },
): T & { id: string; meta: ScimMeta } {
  return { ...core, id: options.id, meta: options.meta };
}
