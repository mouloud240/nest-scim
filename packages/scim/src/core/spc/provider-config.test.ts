import { describe, expect, it } from 'vitest';
import { DEFAULT_SCIM_SERVICE_CONFIG, SPC_SCHEMA } from './provider-config';

describe('DEFAULT_SCIM_SERVICE_CONFIG (RFC 7643 §5)', () => {
  it('carries the SPC schema URN and all REQUIRED sections', () => {
    expect(DEFAULT_SCIM_SERVICE_CONFIG.schemas).toEqual([SPC_SCHEMA]);
    // Every §5 section REQUIRED — presence, never omission.
    for (const section of ['patch', 'bulk', 'filter', 'changePassword', 'sort', 'etag'] as const) {
      expect(typeof DEFAULT_SCIM_SERVICE_CONFIG[section].supported).toBe('boolean');
    }
  });

  it('announces PATCH supported with 200 filter maxResults', () => {
    expect(DEFAULT_SCIM_SERVICE_CONFIG.patch.supported).toBe(true);
    expect(DEFAULT_SCIM_SERVICE_CONFIG.filter).toEqual({ supported: true, maxResults: 200 });
  });

  it('declares v1-unshipped features unsupported (bulk/changePassword/sort/etag)', () => {
    expect(DEFAULT_SCIM_SERVICE_CONFIG.bulk).toEqual({ supported: false, maxOperations: 0, maxPayloadSize: 0 });
    for (const section of ['changePassword', 'sort', 'etag'] as const) {
      expect(DEFAULT_SCIM_SERVICE_CONFIG[section].supported).toBe(false);
    }
  });

  it('ships one primary bearer authentication scheme', () => {
    const schemes = DEFAULT_SCIM_SERVICE_CONFIG.authenticationSchemes;

    expect(schemes).toHaveLength(1);
    expect(schemes[0]).toEqual({
      name: 'OAuth Bearer Token',
      description: 'Authentication scheme using the OAuth Bearer Token standard (RFC 6750)',
      specUri: 'http://www.rfc-editor.org/info/rfc6750',
      type: 'oauthbearertoken',
      primary: true,
    });
  });

  it('omits documentationUri/meta by default', () => {
    expect('documentationUri' in DEFAULT_SCIM_SERVICE_CONFIG).toBe(false);
    expect('meta' in DEFAULT_SCIM_SERVICE_CONFIG).toBe(false);
  });
});
