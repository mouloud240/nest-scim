import { describe, expect, it } from 'vitest';
import { LIST_RESPONSE_SCHEMA, Page, ScimListQuery, ScimListResponse } from './list';
import { PATCH_OP_SCHEMA, PatchOperation, PatchRequest } from './patch';
import { ScimMeta } from './common';
import { SCIM_USER_SCHEMA, ScimUser, ScimUserCreate, ScimUserResource } from './user';

/** Runtime fixtures proving the type modules compose into valid SCIM shapes. */
const demoMeta: ScimMeta = {
  resourceType: 'User',
  created: '2010-01-23T04:56:22Z',
  lastModified: '2011-05-13T04:42:34Z',
  location: 'https://example.com/v2/Users/2819c223',
  version: 'W/"3694e05e9dff590"',
};

const demoUser: ScimUser = {
  userName: 'bjensen@example.com',
  externalId: '2819c223-7f76-453a-919d-413861904646',
  name: { givenName: 'Barbara', familyName: 'Jensen', formatted: 'Barbara J Jensen, III' },
  active: true,
  emails: [{ value: 'bjensen@example.com', type: 'work', primary: true }],
  phoneNumbers: [{ value: '+1-201-555-0123', type: 'mobile' }],
  addresses: [{ streetAddress: '100 Universal City Plaza', locality: 'Hollywood', region: 'CA', postalCode: '91601', country: 'US', type: 'work' }],
};

describe('core resource types (RFC 7643 §3.1/§4.1, RFC 7644 §3.4.2/§3.5.1)', () => {
  it('composes a full ScimUserResource (core attrs + id + meta)', () => {
    const resource: ScimUserResource = { ...demoUser, id: '2819c223', meta: demoMeta };

    expect(resource.id).toBe('2819c223');
    expect(resource.meta?.resourceType).toBe('User');
  });

  it('ScimUserCreate accepts payloads without readOnly groups', () => {
    const create: ScimUserCreate = { userName: 'newuser', password: 'secret' };

    expect(create.length).toEqual(undefined);
  });

  it('ScimUserCreate rejects readOnly groups at type level', () => {
    // @ts-expect-error — groups is readOnly and excluded from create payloads (§4.1.2)
    const bad: ScimUserCreate = { userName: 'x', groups: [] };

    expect(bad).toBeDefined();
  });

  it('accepts a PATCH request for SCIM 2.0 compliant clients to include Operations (§3.5.1)', () => {
    const op: PatchOperation = { op: 'replace', path: 'active', value: false };
    const req: PatchRequest = { schemas: [PATCH_OP_SCHEMA], Operations: [op] };

    expect(req.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:PatchOp']);
    expect(req.Operations).toHaveLength(1);
  });

  it('ScimUser flow composes to ScimUserResource', () => {
    const withId: ScimUserResource = { ...demoUser, id: '1' };

    expect(withId).toMatchObject({ userName: 'bjensen@example.com' });
  });

  it('list query + response types compose (§3.4.2)', () => {
    const query: ScimListQuery = { startIndex: 1, count: 100, filter: 'userName eq "bjensen@example.com"' };
    const page: Page<ScimUser> = { totalResults: 3, items: [demoUser] };

    const response: ScimListResponse<ScimUserResource> = {
      schemas: [LIST_RESPONSE_SCHEMA],
      totalResults: page.totalResults,
      itemsPerPage: page.items.length,
      startIndex: query.startIndex,
      Resources: page.items.map((u) => ({ ...u, id: '2819c223' })),
    };

    expect(response.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:ListResponse']);
    expect(response.totalResults).toBe(3);
    expect(response.itemsPerPage).toBe(1);
    expect(response.Resources).toHaveLength(1);
  });

  it('exposes the schema URN constants from §4.1', () => {
    expect(SCIM_USER_SCHEMA).toBe('urn:ietf:params:scim:schemas:core:2.0:User');
  });
});
