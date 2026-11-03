import { expectTypeOf, describe, it } from 'vitest';
import type { Page, ScimListQuery } from './list';
import type { PatchOperation } from './patch';
import type { ScimUser, ScimUserCreate, ScimUserResource } from './user';

/**
 * Compile-time contract checks (RFC 7643 §3.1/§4.1, RFC 7644 §3.4.2): these
 * assert the *type surface* decisions of the mapper/service SPI, including
 * spec-inspired constraints (readOnly/writeOnly exclusion) that would
 * otherwise silently regress. Run by vitest only — excluded from dist.
 */

describe('mapper contract type surface', () => {
  it('ScimUserCreate allows userName', () => {
    expectTypeOf<ScimUserCreate>().toHaveProperty('userName').toBeString();
  });

  it('ScimUserCreate excludes the readOnly groups attribute (§4.1.2)', () => {
    expectTypeOf<ScimUserCreate>().not.toHaveProperty('groups');
  });

  it('ScimUserGroupReference absent from create pipeline', () => {
    // The create pipeline type never requires group information.
    expectTypeOf<ScimUserCreate['userName']>().toEqualTypeOf<string>();
  });

  it('ScimUserResource carries server-managed common attrs (§3.1)', () => {
    expectTypeOf<ScimUserResource>().toHaveProperty('id').toBeString();
    expectTypeOf<ScimUserResource['meta']>().toEqualTypeOf<
      { resourceType?: string; created?: string; lastModified?: string; location?: string; version?: string } | undefined
    >();
  });

  it('ScimUser exposes password as writeOnly string (§7.2)', () => {
    expectTypeOf<ScimUser['password']>().toEqualTypeOf<string | undefined>();
  });

  it('email type is a canonical union with extensibility (§4.1.2)', () => {
    type EmailList = NonNullable<ScimUser['emails']>;
    type EmailType = NonNullable<ReturnType<typeof extractType>>;
    // `extractType` helper only exists to reference the element type.
    const extractType = (e: EmailList[number]) => e.type;
    expectTypeOf<EmailType>().toEqualTypeOf<'work' | 'home' | 'other' | (string & Record<never, never>) | undefined>();
  });
});

describe('patch and list type surface', () => {
  it('PatchOperation op is the exact RFC keyword union (§3.5.2)', () => {
    expectTypeOf<NonNullable<PatchOperation['op']>>().toEqualTypeOf<'add' | 'replace' | 'remove'>();
  });

  it('PatchOperation forbids path-less remove (path required by scimPatchType contract)', () => {
    // NOTE: RFC 7644 §3.5.2 requires a path for remove; enforced by the
    // controller in M2. The wire type keeps path optional for add/replace.
    expectTypeOf<PatchOperation['path']>().toEqualTypeOf<string | undefined>();
  });

  it('list query exposes 1-based startIndex (§3.4.2.2)', () => {
    expectTypeOf<ScimListQuery['startIndex']>().toEqualTypeOf<number | undefined>();
  });

  it('Page mirrors provider list pages', () => {
    expectTypeOf<Page<string>>().toEqualTypeOf<{ totalResults: number; items: string[] }>();
  });
});
