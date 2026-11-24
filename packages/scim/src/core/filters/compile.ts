/**
 * Filter compilation — RFC 7644 §3.4.2.2. Resolves the parser AST through
 * the mapper's `attributePathMap` into a {@link DomainFilter}: the store
 * sees only its own field paths, never SCIM vocabulary. Any combination we
 * cannot translate is rejected here as 400 invalidFilter (Table 9:
 * "attribute and filter comparison combination is not supported").
 */
import { invalidFilter } from '../errors/factories';
import type { ScimSchemaAttribute } from '../schemas/schema-types';
import { SCIM_USER_SCHEMA_DESCRIPTOR } from '../schemas/user-schema';
import type { ComparisonOp, DomainFilter } from './domain-filter';
import type { ScimFilterExpression } from './parse';

/** Lower-cased SCIM path → descriptor attribute ("emails", "emails.type"). */
const ATTRIBUTES = new Map<string, ScimSchemaAttribute>();
for (const attribute of SCIM_USER_SCHEMA_DESCRIPTOR.attributes) {
  ATTRIBUTES.set(attribute.name.toLowerCase(), attribute);
  for (const sub of attribute.subAttributes ?? []) {
    ATTRIBUTES.set(`${attribute.name.toLowerCase()}.${sub.name.toLowerCase()}`, sub);
  }
}

const RANGE_OPS: ReadonlySet<string> = new Set(['gt', 'lt', 'ge', 'le']);

function attributeFor(scimPath: string): ScimSchemaAttribute | undefined {
  return ATTRIBUTES.get(scimPath.toLowerCase());
}

interface CompileContext {
  lookup: Map<string, string>;
  /** SCIM prefix inside a value path ("emails."), empty at the top level. */
  scimPrefix: string;
  /** Domain prefix inside a value path ("emails."), empty at the top level. */
  domainPrefix: string;
  inValuePath: boolean;
}

function lookupFor(map: Readonly<Record<string, string>>): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [scimPath, domainPath] of Object.entries(map)) {
    lookup.set(scimPath.toLowerCase(), domainPath);
  }
  return lookup;
}

function unsupported(scimPath: string): never {
  throw invalidFilter({
    detail: `The filter attribute "${scimPath}" is not supported by this service provider.`,
  });
}

/** Resolves one SCIM attrPath (relative inside a value path) to its domain path. */
function resolvePath(
  scimPath: string,
  ctx: CompileContext,
): { scimPath: string; domainPath: string } {
  const fullScim = ctx.inValuePath ? `${ctx.scimPrefix}${scimPath}` : scimPath;
  const mapped = ctx.lookup.get(fullScim.toLowerCase());
  if (mapped === undefined) unsupported(fullScim);

  if (!ctx.inValuePath) return { scimPath: fullScim, domainPath: mapped };
  if (!mapped.startsWith(`${ctx.domainPrefix}.`)) {
    throw invalidFilter({
      detail: `The filter attribute "${fullScim}" cannot be translated for value-path matching.`,
    });
  }
  return { scimPath: fullScim, domainPath: mapped.slice(ctx.domainPrefix.length + 1) };
}

/** RFC 7644 Table 3: boolean/binary gt/lt/ge/le MUST 400, complex needs a sub-attribute. */
function assertComparison(scimPath: string, op: ComparisonOp | 'ne'): void {
  const attribute = attributeFor(scimPath);
  if (attribute === undefined) return; // common attrs (id/meta/schemas) or extensions
  if (attribute.type === 'complex') {
    throw invalidFilter({
      detail: `The filter attribute "${scimPath}" is complex and requires a fully qualified sub-attribute.`,
    });
  }
  if (RANGE_OPS.has(op) && (attribute.type === 'boolean' || attribute.type === 'binary')) {
    throw invalidFilter({
      detail: `The operator "${op}" is not supported for the "${scimPath}" attribute type.`,
    });
  }
}

/** RFC 7644 §3.4.2.2 case rule, driven by the shipped schema descriptor. */
function resolveIgnoreCase(scimPath: string, value: string | number | boolean | null): boolean {
  if (typeof value !== 'string') return false;
  const attribute = attributeFor(scimPath);
  if (attribute === undefined) return true; // unknown string-ish path: match engine folding
  if (attribute.type !== 'string' && attribute.type !== 'reference') return false;
  return attribute.caseExact !== true;
}

function assertValuePathContainer(scimPath: string): void {
  const attribute = attributeFor(scimPath);
  if (attribute === undefined || attribute.type !== 'complex' || !attribute.multiValued) {
    throw invalidFilter({
      detail: `The filter attribute "${scimPath}" does not support value-path filtering.`,
    });
  }
}

function compileNode(filter: ScimFilterExpression, ctx: CompileContext): DomainFilter {
  switch (filter.op) {
    case 'and':
    case 'or':
      return { op: filter.op, filters: filter.filters.map((child) => compileNode(child, ctx)) };

    case 'not':
      return { op: 'not', filter: compileNode(filter.filter, ctx) };

    case 'pr': {
      const { domainPath } = resolvePath(filter.attrPath, ctx);
      return { op: 'pr', path: domainPath };
    }

    case '[]': {
      if (ctx.inValuePath) {
        throw invalidFilter({ detail: 'Nested value-path filters are not supported.' });
      }
      const { domainPath } = resolvePath(filter.attrPath, ctx);
      assertValuePathContainer(filter.attrPath);
      const itemFilter = compileNode(filter.valFilter, {
        ...ctx,
        scimPrefix: `${filter.attrPath}.`,
        domainPrefix: domainPath,
        inValuePath: true,
      });
      return { op: '[]', path: domainPath, itemFilter };
    }

    default: {
      const { scimPath, domainPath } = resolvePath(filter.attrPath, ctx);
      assertComparison(scimPath, filter.op);
      const ignoreCase = resolveIgnoreCase(scimPath, filter.compValue);
      if (filter.op === 'ne') {
        return {
          op: 'and',
          filters: [
            { op: 'pr', path: domainPath },
            { op: 'not', filter: { op: 'eq', path: domainPath, value: filter.compValue, ignoreCase } },
          ],
        };
      }
      return { op: filter.op, path: domainPath, value: filter.compValue, ignoreCase };
    }
  }
}

/**
 * Compiles a parsed §3.4.2.2 filter to the store-facing {@link DomainFilter}.
 * Throws 400 invalidFilter for unmapped attributes and unsupported
 * operator/attribute combinations; guaranteed synchronous (parse time).
 */
export function compileFilter(
  filter: ScimFilterExpression,
  attributePathMap: Readonly<Record<string, string>>,
): DomainFilter {
  return compileNode(filter, {
    lookup: lookupFor(attributePathMap),
    scimPrefix: '',
    domainPrefix: '',
    inValuePath: false,
  });
}
