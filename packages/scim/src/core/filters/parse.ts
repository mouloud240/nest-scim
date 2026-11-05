/**
 * Filter parsing — RFC 7644 §3.4.2.2. The engine (scim2-parse-filter)
 * builds the AST; this module adapts it to our wire behavior: engine
 * syntax errors → 400 invalidFilter, and core URN prefixes stripped from
 * attrPaths so the evaluator's plain-key lookup still resolves them.
 */
import { parse as engineParse, Filter } from 'scim2-parse-filter';
import { invalidFilter } from '../errors/factories';
import { CORE_URN_PREFIXES } from '../attributes/attributes';

/** Parsed §3.4.2.2 filter expression — the engine's union, verbatim. */
export type ScimFilterExpression = Filter;

function stripUrn(filter: Filter): void {
  if (filter.op === 'and' || filter.op === 'or') filter.filters.forEach(stripUrn);
  else if (filter.op === 'not') stripUrn(filter.filter);
  else if ('attrPath' in filter) {
    const path = filter.attrPath;
    for (const prefix of CORE_URN_PREFIXES) {
      const joint = `${prefix}:`;
      if (path.toLowerCase().startsWith(joint.toLowerCase())) {
        filter.attrPath = path.slice(joint.length);
        break;
      }
    }
  }
}

/**
 * Parses a `?filter=` string into a normalized {@link ScimFilterExpression}.
 * Throws `invalidFilter` on empty input or engine syntax errors (Table 9:
 * "The specified filter syntax was invalid", §3.4.2.2).
 */
export function parseScimFilter(raw: string): ScimFilterExpression {
  if (raw.trim().length === 0) {
    throw invalidFilter({ detail: 'The specified filter syntax was invalid or empty (RFC 7644 §3.4.2.2).' });
  }
  try {
    const filter = engineParse(raw);
    stripUrn(filter);
    return filter;
  } catch {
    throw invalidFilter({ detail: 'The specified filter syntax was invalid (RFC 7644 §3.4.2.2).' });
  }
}
