import { describe, expect, it } from 'vitest';
import { buildListResponse } from './list-response';
import { ScimUserResource } from '../types/user';

const user: ScimUserResource = {
  id: '2819c223',
  userName: 'bjensen',
};

describe('buildListResponse (RFC 7644 §3.4.2)', () => {
  it('emits exactly the RFC envelope keys for a full (non-paginated) result', () => {
    const body = buildListResponse({ totalResults: 1, items: [user] });

    expect(body).toEqual({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 1,
      Resources: [user],
    });
    expect('startIndex' in body).toBe(false);
    expect('itemsPerPage' in body).toBe(false);
  });

  it('adds REQUIRED startIndex/itemsPerPage when results are partial', () => {
    const body = buildListResponse({ totalResults: 10, items: [user], startIndex: 3 });

    expect(body.startIndex).toBe(3);
    expect(body.itemsPerPage).toBe(1);
    expect(body.Resources).toEqual([user]);
  });

  it('defaults startIndex to 1-based semantics', () => {
    const body = buildListResponse({ totalResults: 5, items: [user] });

    expect(body.startIndex).toBe(1);
  });

  it('returns 200-style empty envelope when nothing matches', () => {
    const body = buildListResponse<ScimUserResource>({ totalResults: 0, items: [] });

    expect(body).toEqual({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 0,
    });
    expect('Resources' in body).toBe(false);
  });

  it('honors explicit paginated even for exact-fit pages', () => {
    const body = buildListResponse({ totalResults: 1, items: [user], paginated: true });

    expect(body.startIndex).toBe(1);
    expect(body.itemsPerPage).toBe(1);
  });

  it('emits an empty Resources array on an explicit paginated no-match page', () => {
    const body = buildListResponse<ScimUserResource>({ totalResults: 100, items: [], paginated: true });

    expect(body.Resources).toEqual([]);
    expect(body.itemsPerPage).toBe(0);
  });
});
