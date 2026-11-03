/**
 * ServiceProviderConfig types + RFC defaults — RFC 7643 §5
 * (docs/rfc/rfc7643.txt §5: every complex section REQUIRED; all attributes
 * readOnly; "id" NOT required for this resource), rendered via the
 * urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig schema and
 * served by GET /ServiceProviderConfig (RFC 7644 §4).
 */

import type { ScimMeta } from '../types/common';

/** Schema URN of the ServiceProviderConfig resource (RFC 7643 §5). */
export const SPC_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig' as const;

/** PATCH support flag section (RFC 7643 §5). */
export interface ScimSPPatchSection {
  supported: boolean;
}

/** Bulk support section (RFC 7643 §5 — maxOperations/maxPayloadSize REQUIRED when announced). */
export interface ScimSPBulkSection {
  supported: boolean;
  maxOperations: number;
  maxPayloadSize: number;
}

/** FILTER support section (RFC 7643 §5 — maxResults REQUIRED). */
export interface ScimSPFilterSection {
  supported: boolean;
  maxResults: number;
}

/** changePassword section (RFC 7643 §5). */
export interface ScimSPChangePasswordSection {
  supported: boolean;
}

/** SORT section (RFC 7643 §5). */
export interface ScimSPSortSection {
  supported: boolean;
}

/** ETag section (RFC 7643 §5). */
export interface ScimSPEtagSection {
  supported: boolean;
}

/** Authentication scheme descriptor (RFC 7643 §5 sub-attributes). */
export interface ScimAuthenticationScheme {
  /** REQUIRED — common name, e.g. "HTTP Basic". */
  name: string;
  /** REQUIRED — human description. */
  description: string;
  /** REQUIRED identifier among oauth|oauth2|oauthbearertoken|httpbasic|httpdigest. */
  type: 'oauth' | 'oauth2' | 'oauthbearertoken' | 'httpbasic' | 'httpdigest' | (string & Record<never, never>);
  /** OPTIONAL — auth scheme spec URN/URL. */
  specUri?: string;
  /** OPTIONAL — auth scheme usage documentation URL. */
  documentationUri?: string;
  /** OPTIONAL (RFC 7643 §2.4) — single primary scheme. */
  primary?: boolean;
}

/**
 * The ServiceProviderConfig resource body (RFC 7643 §5). Every section is
 * REQUIRED; the resource carries common attrs (meta) but no `id`.
 */
export interface ScimServiceProviderConfig {
  schemas: [typeof SPC_SCHEMA];
  documentationUri?: string;
  patch: ScimSPPatchSection;
  bulk: ScimSPBulkSection;
  filter: ScimSPFilterSection;
  changePassword: ScimSPChangePasswordSection;
  sort: ScimSPSortSection;
  etag: ScimSPEtagSection;
  authenticationSchemes: ScimAuthenticationScheme[];
  meta?: ScimMeta;
}

/**
 * RFC-conformant defaults for @nest-scim/core v1: PATCH supported (M3 uses
 * scim-patch), server-side filter with a 200-result ceiling, and bulk /
 * changePassword / sort / etag unsupported (all v2 features).
 */
export const DEFAULT_SCIM_SERVICE_CONFIG: ScimServiceProviderConfig = {
  schemas: [SPC_SCHEMA],
  patch: { supported: true },
  bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
  filter: { supported: true, maxResults: 200 },
  changePassword: { supported: false },
  sort: { supported: false },
  etag: { supported: false },
  authenticationSchemes: [
    {
      name: 'OAuth Bearer Token',
      description: 'Authentication scheme using the OAuth Bearer Token standard (RFC 6750)',
      specUri: 'http://www.rfc-editor.org/info/rfc6750',
      type: 'oauthbearertoken',
      primary: true,
    },
  ],
};
