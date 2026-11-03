/**
 * ListResponse builder — RFC 7644 §3.4.2 (docs/rfc/rfc7644.txt lines 818–
 * 848): `totalResults` REQUIRED; `Resources` REQUIRED when totalResults is
 * non-zero; `startIndex`/`itemsPerPage` REQUIRED when partial results are
 * returned due to pagination; a no-match query is still HTTP 200.
 * The literal attribute name is "Resources" — capital R by spec.
 */

import { LIST_RESPONSE_SCHEMA, ScimListResponse } from '../types/list';

/** Inputs into building a ListResponse envelope. */
export interface ListResponseInput<R> {
  /** Filter-ignoring total (§3.4.2, REQUIRED). */
  totalResults: number;
  /** The current page rows, already mapped to SCIM form. */
  items: R[];
  /** 1-based offset actually served; defaults to 1. */
  startIndex?: number;
  /**
   * Force pagination attributes on/off. Defaults to "on" whenever the
   * served page differs from the full result set (partial results ⇒ RFC
   * requires startIndex/itemsPerPage).
   */
  paginated?: boolean;
}

/**
 * Builds a §3.4.2 ListResponse body. Envelope keys are emitted in RFC
 * casing; pagination attributes appear only when results are partial
 * (or explicitly forced via `paginated`).
 */
export function buildListResponse<R>({
  totalResults,
  items,
  startIndex,
  paginated,
}: ListResponseInput<R>): ScimListResponse<R> {
  const isPaginated = paginated ?? items.length !== totalResults;

  const body: ScimListResponse<R> = {
    schemas: [LIST_RESPONSE_SCHEMA],
    totalResults,
  };

  if (items.length > 0 || isPaginated) body.Resources = items;
  if (isPaginated) {
    body.startIndex = startIndex ?? 1;
    body.itemsPerPage = items.length;
  }
  return body;
}
