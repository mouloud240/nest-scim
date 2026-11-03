import { describe, expect, it } from 'vitest';
import { DEFAULT_SCIM_SERVICE_CONFIG } from './provider-config';
import { buildServiceProviderConfig } from './merge-provider-config';

describe('buildServiceProviderConfig (user overrides)', () => {
  it('returns unaltered defaults for empty overrides', () => {
    const config = buildServiceProviderConfig();

    expect(config).toEqual(DEFAULT_SCIM_SERVICE_CONFIG);
  });

  it('merges true/false flags key-wise without dropping siblings', () => {
    const config = buildServiceProviderConfig({ patch: { supported: false }, etag: { supported: true } });

    expect(config.patch.supported).toBe(false);
    expect(config.bulk.supported).toBe(false); // untouched section
    expect(config.etag.supported).toBe(true);
  });

  it('overrides filter.maxResults independently from supported', () => {
    const config = buildServiceProviderConfig({ filter: { maxResults: 50 } });

    expect(config.filter).toEqual({ supported: true, maxResults: 50 });
  });

  it('replaces the whole authenticationSchemes array', () => {
    const custom = [{ name: 'HTTP Basic', description: 'Basic RFC 7617', type: 'httpbasic', primary: true }];
    const config = buildServiceProviderConfig({ authenticationSchemes: custom });

    expect(config.authenticationSchemes).toEqual(custom);
    expect('authenticationSchemes' in DEFAULT_SCIM_SERVICE_CONFIG ? DEFAULT_SCIM_SERVICE_CONFIG.authenticationSchemes : []).toHaveLength(1);
  });

  it('keeps arrays untouched when only documentationUri is overridden', () => {
    const config = buildServiceProviderConfig({ documentationUri: 'https://docs.example.com/scim' });

    expect(config.documentationUri).toBe('https://docs.example.com/scim');
    expect(config.authenticationSchemes).toEqual(DEFAULT_SCIM_SERVICE_CONFIG.authenticationSchemes);
  });

  it('never hands out references into the module default (mutation safety)', () => {
    const config = buildServiceProviderConfig({ patch: { supported: false } });

    config.patch.supported = true;
    config.bulk.maxOperations = 42;

    expect(DEFAULT_SCIM_SERVICE_CONFIG.patch.supported).toBe(true);
    expect(DEFAULT_SCIM_SERVICE_CONFIG.bulk.maxOperations).toBe(0);
  });

  it('still emits every RFC §5 REQUIRED section after aggressive overrides', () => {
    const config = buildServiceProviderConfig({ bulk: { supported: true } });

    for (const section of ['patch', 'bulk', 'filter', 'changePassword', 'sort', 'etag'] as const) {
      expect(typeof config[section].supported).toBe('boolean');
    }
    expect(config.bulk.maxOperations).toBe(0); // defaults survives partial bulk override
    expect(config.bulk.supported).toBe(true);
  });
});
