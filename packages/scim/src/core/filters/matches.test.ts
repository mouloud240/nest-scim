import { describe, expect, it } from 'vitest';
import { matches } from './matches';
import { parseScimFilter } from './parse';

// Wire-shaped resource (what toScim emits) — no id/meta/password.
const bob = {
  userName: 'bob',
  displayName: 'Bob Jones',
  name: { familyName: 'Jones', givenName: 'Bob' },
  userType: 'Employee',
  emails: [{ type: 'work', value: 'bob@example.com' }, { type: 'home', value: 'b@home.io' }],
  age: 42,
};

const hit = (user: object, raw: string) => matches(user, parseScimFilter(raw));

describe('matches — RFC 7644 §3.4.2.2 semantics', () => {
  it('eq/pr on singular attributes', () => {
    expect(hit(bob, 'userName eq "bob"')).toBe(true);
    expect(hit(bob, 'userName pr')).toBe(true);
    expect(hit(bob, 'nickName pr')).toBe(false);
    expect(hit(bob, 'age pr')).toBe(true);
  });

  it('string comparisons are case-insensitive (attribute caseExact false)', () => {
    expect(hit(bob, 'userName eq "BOB"')).toBe(true);
    expect(hit(bob, 'userType ne "employee"')).toBe(false);
    expect(hit(bob, 'userName sw "BOB"')).toBe(true);
    expect(hit(bob, 'userName ew "OB"')).toBe(true);
    expect(hit(bob, 'userName ew "obx"')).toBe(false);
  });

  it('not / and / or with grouping', () => {
    expect(hit(bob, 'not (userType eq "Guest")')).toBe(true);
    expect(hit(bob, 'userType eq "Employee" and name.familyName eq "jones"')).toBe(true);
    expect(hit(bob, 'userType eq "Guest" or name.givenName eq "bob"')).toBe(true);
  });

  it('value path filters quantify per element with any-match', () => {
    expect(hit(bob, 'emails[type eq "work"]')).toBe(true);
    expect(hit(bob, 'emails[type eq "fax"]')).toBe(false);
    expect(hit(bob, 'emails[type eq "work" and value co "@example.com"]')).toBe(true);
    expect(hit(bob, 'ims[type eq "xmpp"]')).toBe(false); // absent array
  });

  it('dotted sub-attribute paths resolve into complex values', () => {
    expect(hit(bob, 'name.familyName eq "Jones"')).toBe(true);
    expect(hit(bob, 'name.familyName sw "j"')).toBe(true);
  });

  it('numeric comparisons use string ordering rules per RFC', () => {
    expect(hit(bob, 'age gt 7')).toBe(true);
    expect(hit(bob, 'age lt 7')).toBe(false);
  });

  it('URN-prefixed paths resolve after parser normalization', () => {
    expect(
      hit(bob, 'urn:ietf:params:scim:schemas:core:2.0:User:userName eq "bob"'),
    ).toBe(true);
  });

  it('missing attributes make comparisons false, pr included', () => {
    expect(hit(bob, 'ims pr')).toBe(false);
    expect(hit(bob, 'ims ne "xmpp"')).toBe(false);
  });
});
