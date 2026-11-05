/**
 * Filter evaluation — RFC 7644 §3.4.2.2. A thin wrapper over the engine's
 * Tester with the RFC case rule (line 1216: string comparisons are case
 * insensitive unless the attribute is caseExact) driven by our User
 * schema descriptor data table.
 */
import { Tester } from 'scim2-parse-filter';
import { SCIM_USER_SCHEMA_DESCRIPTOR } from '../schemas/user-schema';
import type { ScimFilterExpression } from './parse';

/** attrPath (case-insensitive) → caseExact flag from the descriptor table. */
const CASE_EXACT = new Map<string, boolean>();
for (const attr of SCIM_USER_SCHEMA_DESCRIPTOR.attributes) {
  CASE_EXACT.set(attr.name.toLowerCase(), attr.caseExact ?? false);
  for (const sub of attr.subAttributes ?? []) {
    CASE_EXACT.set(`${attr.name.toLowerCase()}.${sub.name.toLowerCase()}`, sub.caseExact ?? false);
  }
}

function resolveCaseExact(path: string): boolean {
  const lowered = path.toLowerCase();
  return CASE_EXACT.get(lowered) ?? CASE_EXACT.get(lowered.split('.').pop() ?? lowered) ?? false;
}

const MATCHER = new Tester({ caseExact: resolveCaseExact });

/**
 * Tests one resource (SCIM wire form) against a parsed filter. Absent
 * attributes ⇒ false (row excluded), arrays quantify with any-match,
 * value paths (`emails[type eq "work"]`) evaluate per element.
 */
export function matches(user: object, filter: ScimFilterExpression): boolean {
  return MATCHER.test(user, filter);
}
