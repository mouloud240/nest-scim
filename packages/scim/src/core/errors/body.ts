/**
 * RFC 7644 §3.12 ErrorResponse rendering (docs/rfc/rfc7644.txt lines
 * 3703–3911): schemas URN `urn:ietf:params:scim:api:messages:2.0:Error`,
 * `status` REQUIRED and serialized as a JSON string, `scimType` and
 * `detail` OPTIONAL and omitted when absent.
 */

import { ScimError } from './scim-error';

/** Status URN constant from §3.12. */
export const ERROR_SCHEMA_URI = 'urn:ietf:params:scim:api:messages:2.0:Error';

/** Shape of the JSON body for every SCIM error response. */
export interface ScimErrorResponse {
  schemas: [typeof ERROR_SCHEMA_URI];
  /** HTTP status as a JSON string (§3.12: "expressed as a JSON string"). */
  status: string;
  scimType?: ScimError['scimType'];
  detail?: string;
}

/** Renders a {@link ScimError} into the wire-format error body. */
export function toErrorBody(error: ScimError): ScimErrorResponse {
  const body: ScimErrorResponse = {
    schemas: [ERROR_SCHEMA_URI],
    status: String(error.status),
  };
  if (error.scimType !== undefined) body.scimType = error.scimType;
  if (error.detail !== undefined) body.detail = error.detail;
  return body;
}
