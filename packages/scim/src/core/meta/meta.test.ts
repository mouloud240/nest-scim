import { describe, expect, it } from 'vitest';
import { locationFor, metaFor, normalizeBasePath, scimDateTime, withResourceCommons } from './meta';

describe('normalizeBasePath', () => {
  it('strips trailing slashes', () => {
    expect(normalizeBasePath('/scim/v2/')).toBe('/scim/v2');
  });

  it('collapses duplicate slashes', () => {
    expect(normalizeBasePath('/scim//v2')).toBe('/scim/v2');
  });

  it('keeps the root path alone', () => {
    expect(normalizeBasePath('/')).toBe('/');
    expect(normalizeBasePath('')).toBe('/');
  });
});

describe('locationFor (RFC 7643 §3.1 meta.location)', () => {
  it('assembles base + resource + encoded id', () => {
    expect(locationFor('/scim/v2', 'Users', 'abc123')).toBe('/scim/v2/Users/abc123');
  });

  it('percent-encodes ids containing unsafe path characters', () => {
    expect(locationFor('/scim/v2', 'Users', 'a/b')).toBe('/scim/v2/Users/a%2Fb');
    expect(locationFor('/scim/v2', 'Users', 'id:with:colons')).toBe('/scim/v2/Users/id%3Awith%3Acolons');
  });

  it('tolerates a trailing slash on the base path', () => {
    expect(locationFor('/scim/v2/', 'Users', 'x')).toBe('/scim/v2/Users/x');
  });
});

describe('scimDateTime (RFC 7643 §2.3.1)', () => {
  it('formats with second precision and Z zone', () => {
    expect(scimDateTime(new Date('2010-01-23T04:56:22.123Z'))).toBe('2010-01-23T04:56:22Z');
  });

  it('keeps valid input as-is', () => {
    expect(scimDateTime(new Date('2010-01-23T04:56:22Z'))).toBe('2010-01-23T04:56:22Z');
  });
});

describe('metaFor', () => {
  const created = new Date('2010-01-23T04:56:22Z');

  it('builds meta with resourceType, location and dates', () => {
    const meta = metaFor({ resourceType: 'User', location: '/scim/v2/Users/abc', created });

    expect(meta).toEqual({
      resourceType: 'User',
      created: '2010-01-23T04:56:22Z',
      lastModified: '2010-01-23T04:56:22Z',
      location: '/scim/v2/Users/abc',
    });
  });

  it('takes an explicit lastModified and version', () => {
    const meta = metaFor({
      resourceType: 'User',
      location: '/Users/x',
      created,
      lastModified: new Date('2011-05-13T04:42:34Z'),
      version: 'W/"1"',
    });

    expect(meta.lastModified).toBe('2011-05-13T04:42:34Z');
    expect(meta.version).toBe('W/"1"');
  });

  it('omits the version key when not provided', () => {
    expect('version' in metaFor({ resourceType: 'User', location: '/x', created })).toBe(false);
  });

  it('omits created/lastModified when the store tracks no timestamps', () => {
    const meta = metaFor({ resourceType: 'User', location: '/Users/1' });

    expect(meta).toEqual({ resourceType: 'User', location: '/Users/1' });
    expect('created' in meta).toBe(false);
    expect('lastModified' in meta).toBe(false);
  });
});

describe('withResourceCommons', () => {
  it('attaches id and meta without mutating the input object', () => {
    const core = { userName: 'bjensen' };
    const meta = metaFor({ resourceType: 'User', location: '/Users/1', created: new Date('2015-01-01T00:00:00Z') });

    const resource = withResourceCommons(core, { id: '1', meta });

    expect(resource.id).toBe('1');
    expect(resource.meta).toBe(meta);
    expect('id' in core).toBe(false);
  });
});
