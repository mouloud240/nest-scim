/**
 * Shared resource attributes — RFC 7643 §3.1 (docs/rfc/rfc7643.txt §3.1):
 * `meta` sub-attributes are all server-assigned and scimType in requests is
 * ignored (RFC 7643 §7: server MUST reject failing GET on reference).
 */

/**
 * Common attributes of every SCIM resource (RFC 7643 §3.1). All fields are
 * server-assigned; the library emits them and user mappers never touch them.
 */
export interface ScimMeta {
  resourceType?: string;
  created?: string;
  lastModified?: string;
  location?: string;
  version?: string;
}
