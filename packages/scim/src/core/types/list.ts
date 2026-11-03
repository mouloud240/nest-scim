/**
 * List/query message types — RFC 7644 §3.4.2
 * (docs/rfc/rfc7644.txt §3.4.2: ListResponse envelope with totalResults,
 * itemsPerPage, startIndex, Resources; §3.4.2.2 query-string parameters).
 */

/** Schema URN of a list response (RFC 7644 §3.4.2). */
export const LIST_RESPONSE_SCHEMA =
  'urn:ietf:params:scim:api:messages:2.0:ListResponse' as const;

/**
 * Paginated result envelope (RFC 7644 §3.4.2). `Resources` is the literal
 * attribute name — capital R by spec. `itemsPerPage`/`startIndex` are
 * OPTIONAL when totalResults is 0 or omitting them is more natural to the
 * service provider.
 */
export interface ScimListResponse<R = unknown> {
  schemas: [typeof LIST_RESPONSE_SCHEMA];
  /** Total number of results matching the filter, ignoring pagination. */
  totalResults: number;
  /** Shown item count for the current page (defaults to Resources.length). */
  itemsPerPage?: number;
  /** 1-based offset of the first item (defaults to 1). */
  startIndex?: number;
  /** Page rows — literal `Resources` attribute (capital R). */
  Resources?: R[];
}

/**
 * Filter + paging parameters as received from the IdP/HTTP layer,
 * already section-split into pagination + filter + attributes for the
 * service provider's `list` implementation to consume.
 */
export interface ScimListQuery {
  /** 1-based offset — §3.4.2.2 (defaults to 1). */
  startIndex?: number;
  /** Page size — 0..maxResults (§3.4.2.2). */
  count?: number;
  /** Raw filter string; parsed filter tree supplied alongside the query. */
  filter?: string;
  /** §3.9 attribute inclusion hint. */
  attributes?: string[];
  /** §3.9 attribute exclusion hint. */
  excludedAttributes?: string[];
}

/** Provider-side list page: one page of items plus the filter-ignoring total. */
export interface Page<T> {
  /** Total results matching the filter, ignoring pagination (§3.4.2). */
  totalResults: number;
  /** The page rows in provider-native form; the caller maps them to SCIM. */
  items: T[];
}
