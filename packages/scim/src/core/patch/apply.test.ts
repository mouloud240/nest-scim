/**
 * Wrapper tests — parse/normalize validation + application semantics +
 * error taxonomy mapping. Facts verified against the installed engine
 * (scimPatch.js) and RFC 7644 §3.5.2 cites in docs/milestones/M3.md.
 */
import { describe, expect, it } from 'vitest';
import { PATCH_OP_SCHEMA } from '../types/patch';
import { applyPatchRequest, parsePatchOperations } from './apply';

/** A fully-formed SCIM user resource (toScim-shape, JSON-safe by contract). */
const USER: Record<string, unknown> = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
  id: '2819c223-7f76-453a-919d-413861904646',
  userName: 'bjensen@example.com',
  name: { familyName: 'Jensen', givenName: 'Barbara' },
  displayName: 'Barbara Jensen',
  emails: [{ value: 'bjensen@example.com', type: 'work', primary: true }],
  active: true,
};

const ENTERPRISE_URN = 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User';

function patchBody(operations: unknown[]): unknown {
  return { schemas: [PATCH_OP_SCHEMA], Operations: operations };
}

describe('parsePatchOperations (RFC §3.5.2 body MUSTs)', () => {
  it('400 invalidSyntax for non-object bodies', () => {
    for (const bad of [undefined, null, 42, 'x', [], true]) {
      expect(() => parsePatchOperations(bad)).toThrow(/single JSON PATCH object/);
    }
  });

  it('400 invalidSyntax when schemas omits the PatchOp URN (line 1804–1806)', () => {
    const missing = { Operations: [{ op: 'remove', path: 'active' }] };
    expect(() => parsePatchOperations(missing)).toThrow(/must declare "schemas"/);
    const wrongOne = { schemas: ['urn:fake'], Operations: [{ op: 'remove', path: 'active' }] };
    expect(() => parsePatchOperations(wrongOne)).toThrow(PATCH_OP_SCHEMA);
  });

  it('400 invalidSyntax when Operations is missing or empty (line 1808–1810)', () => {
    expect(() => parsePatchOperations({ schemas: [PATCH_OP_SCHEMA] })).toThrow(/"Operations"/);
    expect(() => parsePatchOperations(patchBody([]))).toThrow(/at least one operation/);
  });

  it('400 invalidSyntax for a non-object or unknown op, naming the op index', () => {
    try {
      parsePatchOperations(patchBody([{ op: 'add', path: 'active', value: true }, 'oops']));
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain('Operations[2]');
    }
    try {
      parsePatchOperations(patchBody([{ op: 'copy', path: 'x', value: 'y' }]));
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain('add", "replace", "remove"');
    }
    try {
      parsePatchOperations(patchBody([{ op: 42 }]));
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain('Operations[1]');
    }
  });

  it('400 noTarget when a remove lacks a path (§3.5.2.2, line 2140)', () => {
    expect(() => parsePatchOperations(patchBody([{ op: 'remove' }])))
      .toThrow(/requires a "path"/);
    // add / replace MAY omit path — resource-level payload patch
    const ops = parsePatchOperations(patchBody([{ op: 'add', value: { active: true } }]));
    expect(ops).toEqual([{ op: 'add', path: undefined, value: { active: true } }]);
  });

  it('normalizes case-insensitive op values before the engine (IdP quirk)', () => {
    const ops = parsePatchOperations(patchBody([
      { op: 'Add', path: 'active', value: true },
      { op: 'REPLACE', path: 'active', value: false },
      { op: 'Remove', path: 'active' },
    ]));
    expect(ops.map((op) => op.op)).toEqual(['add', 'replace', 'remove']);
  });

  it('400 invalidPath for a non-string path', () => {
    expect(() => parsePatchOperations(patchBody([{ op: 'remove', path: 42 }])))
      .toThrow(/"path" must be a string/);
  });
});

describe('applyPatchRequest (engine semantics + error mapping)', () => {
  it('applies a replace and never mutates the input (mutateDocument: false)', () => {
    const snapshot = JSON.parse(JSON.stringify(USER));
    const patched = applyPatchRequest(USER, patchBody([
      { op: 'replace', path: 'displayName', value: 'Babs Jensen' },
    ]));

    expect(patched.displayName).toBe('Babs Jensen');
    expect(USER).toEqual(snapshot); // caller object untouched — atomic by construction
    expect(USER.displayName).toBe('Barbara Jensen');
  });

  it('applies ops SEQUENTIALLY — later ops see earlier results (lines 1918–1922)', () => {
    const patched = applyPatchRequest(USER, patchBody([
      { op: 'add', path: 'displayName', value: 'Temporary Name' },
      { op: 'replace', path: 'displayName', value: 'Babs Jensen' },
      { op: 'remove', path: 'displayName' },
    ]));

    expect('displayName' in patched).toBe(false); // remove unassigns entirely
  });

  it('handles the implicit enterprise-schema pattern (URIs, lines 1900–1916)', () => {
    const patched = applyPatchRequest(USER, patchBody([
      {
        op: 'add',
        path: `${ENTERPRISE_URN}:employeeNumber`,
        value: '701982',
      },
    ]));

    const enterprise = patched[ENTERPRISE_URN] as Record<string, unknown> | undefined;
    expect(enterprise?.employeeNumber).toBe('701982');
  });

  it('append-object semantics: add on missing filterless path merges sub-attrs', () => {
    const patched = applyPatchRequest(USER, patchBody([
      { op: 'add', path: 'name', value: { middleName: 'Q' } },
    ]));
    expect(patched.name).toEqual({ familyName: 'Jensen', givenName: 'Barbara', middleName: 'Q' });
  });

  it('replace with a NON-eq valueFilter matching nothing → 400 noTarget (§3.5.2.2)', () => {
    // ne comparison can't be converted to an add, so the engine's no-target
    // path escapes → mapped through Table 9's noTarget wording.
    const thrown = (() => {
      try {
        applyPatchRequest(USER, patchBody([
          { op: 'replace', path: 'emails[type ne "work"].value', value: 'x@y.z' },
        ]));
        expect.unreachable();
      } catch (e: unknown) {
        return e as { scimType?: string; status?: number };
      }
    })();

    expect(thrown.scimType).toBe('noTarget');
    expect(thrown.status).toBe(400);
  });

  it('replace with an eq valueFilter on a missing entry is treated as ADD (RFC line 2376)', () => {
    const patched = applyPatchRequest(USER, patchBody([
      { op: 'replace', path: 'emails[type eq "home"].value', value: 'home@b.com' },
    ]));
    const emails = patched.emails as Array<Record<string, unknown>>;
    expect(emails).toHaveLength(2);
    expect(emails.find((e) => e.type === 'home')).toEqual({ type: 'home', value: 'home@b.com' });
  });

  it('remove with valueFilter matching nothing → silent no-op success (§3.5.2.2 example: member not in group ⇒ no changes)', () => {
    const snapshot = JSON.parse(JSON.stringify(USER));
    const patched = applyPatchRequest(USER, patchBody([
      { op: 'remove', path: 'emails[type eq "ghost"]' },
    ]));

    expect(patched).toEqual(snapshot); // untouched
  });

  it('filter over an EMPTY multi-valued attribute escapes as noTarget (FilterArrayTargetNotFound)', () => {
    const user = { ...USER, emails: [] };
    const thrown = (() => {
      try {
        applyPatchRequest(user, patchBody([
          { op: 'remove', path: 'emails[type eq "work"].value' },
        ]));
        expect.unreachable();
      } catch (e: unknown) {
        return e as { scimType?: string; status?: number };
      }
    })();

    expect(thrown.scimType).toBe('noTarget');
    expect(thrown.status).toBe(400);
  });

  it('raw filter-parse faults degrade to 400 invalidPath (InvalidScimPatchOp)', () => {
    const thrown = (() => {
      try {
        applyPatchRequest(USER, patchBody([{ op: 'remove', path: 'emails[typo eq' }]));
        expect.unreachable();
      } catch (e: unknown) {
        return e as { scimType?: string; status?: number };
      }
    })();

    expect(thrown.scimType).toBe('invalidPath');
    expect(thrown.status).toBe(400);
  });

  it('remove carrying a scalar value on a multi-valued path is an engine no-op (removal-by-value needs arrays; §3.5.2.2)', () => {
    const snapshot = JSON.parse(JSON.stringify(USER));
    const patched = applyPatchRequest(USER, patchBody([
      { op: 'remove', path: 'emails', value: 'not-an-array' },
    ]));
    expect(patched).toEqual(snapshot); // untouched
  });

  it('CVE-2026-48170 / GHSA-9m6g-wc8r-q59c regression: __proto__ payload cannot pollute', () => {
    // JSON.parse mirrors the real wire path: an own "key" named __proto__
    // arrives without triggering the object-literal prototype setter.
    const malformed = JSON.parse(
      '{"schemas":["urn:ietf:params:scim:api:messages:2.0:PatchOp"],' +
      '"Operations":[{"op":"add","path":"urn:x:danger","value":{"__proto__":{"polluted":true}}}]}',
    );

    applyPatchRequest(USER, malformed);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.getPrototypeOf(USER) as Record<string, unknown>).polluted).toBeUndefined();
    expect('polluted' in (Object.getPrototypeOf({}) as object)).toBe(false);
  });
});
