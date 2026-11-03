/**
 * User overrides on the ServiceProviderConfig — RFC 7643 §5
 * (all sections REQUIRED on the wire, so overrides PATCH the defaults
 * rather than replace sections: sections merge key-wise, arrays replace
 * whole — documented, predictable, no deep-merge footguns).
 */

import {
  DEFAULT_SCIM_SERVICE_CONFIG,
  ScimAuthenticationScheme,
  ScimServiceProviderConfig,
  ScimSPBulkSection,
  ScimSPChangePasswordSection,
  ScimSPEtagSection,
  ScimSPFilterSection,
  ScimSPPatchSection,
  ScimSPSortSection,
} from './provider-config';

/** User-supplied knobs. Anything omitted falls back to RFC defaults. */
export interface ScimSPCOverrides {
  documentationUri?: string;
  patch?: Partial<ScimSPPatchSection>;
  bulk?: Partial<ScimSPBulkSection>;
  filter?: Partial<ScimSPFilterSection>;
  changePassword?: Partial<ScimSPChangePasswordSection>;
  sort?: Partial<ScimSPSortSection>;
  etag?: Partial<ScimSPEtagSection>;
  /** Whole-array replacement (§5: authenticationSchemes entries are REQUIRED-complete). */
  authenticationSchemes?: ScimAuthenticationScheme[];
}

/**
 * Produces the effective ServiceProviderConfig from RFC defaults plus
 * user overrides. Sections merge key-wise; `authenticationSchemes`
 * replaces the default array wholesale. Always returns a fresh object —
 * the module default is never handed out to callers.
 */
export function buildServiceProviderConfig(overrides: ScimSPCOverrides = {}): ScimServiceProviderConfig {
  const merged: ScimServiceProviderConfig = {
    schemas: [...DEFAULT_SCIM_SERVICE_CONFIG.schemas],
    patch: { ...DEFAULT_SCIM_SERVICE_CONFIG.patch, ...overrides.patch },
    bulk: {
      ...DEFAULT_SCIM_SERVICE_CONFIG.bulk,
      ...overrides.bulk,
      // REQUIRED numbers never inherit a falsy zero by accident.
      maxOperations: overrides.bulk?.maxOperations ?? DEFAULT_SCIM_SERVICE_CONFIG.bulk.maxOperations,
      maxPayloadSize: overrides.bulk?.maxPayloadSize ?? DEFAULT_SCIM_SERVICE_CONFIG.bulk.maxPayloadSize,
    },
    filter: {
      ...DEFAULT_SCIM_SERVICE_CONFIG.filter,
      ...overrides.filter,
      maxResults: overrides.filter?.maxResults ?? DEFAULT_SCIM_SERVICE_CONFIG.filter.maxResults,
    },
    changePassword: { ...DEFAULT_SCIM_SERVICE_CONFIG.changePassword, ...overrides.changePassword },
    sort: { ...DEFAULT_SCIM_SERVICE_CONFIG.sort, ...overrides.sort },
    etag: { ...DEFAULT_SCIM_SERVICE_CONFIG.etag, ...overrides.etag },
    authenticationSchemes:
      overrides.authenticationSchemes !== undefined
        ? overrides.authenticationSchemes.map((scheme) => ({ ...scheme, 
            ...(scheme.primary === undefined ? {} : { primary: scheme.primary }) }))
        : DEFAULT_SCIM_SERVICE_CONFIG.authenticationSchemes.map((scheme) => ({ ...scheme })),
  };

  if (overrides.documentationUri !== undefined) merged.documentationUri = overrides.documentationUri;
  return merged;
}
