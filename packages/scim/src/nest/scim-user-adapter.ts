/**
 * Resource adapter — the wire⇄SPI bridge the controllers route through.
 *
 * Behavior verified against docs/rfc/rfc7644.txt (grep, never memory):
 * - §3.3  create: 201 + Location + body (§3.3 lines 601–610); readOnly
 *   attributes ignored; userName conflicts MUST be 409 "uniqueness"
 *   (§3.3 lines 623–627 — e.g. duplicate userName). externalId is NOT
 *   server-enforced for uniqueness (RFC 7643 §3.1 lines 888–892: "the
 *   server does not enforce uniqueness") — stores may enforce their own.
 * - §3.4.2.4  pagination: startIndex default 1, <1 → 1; count default =
 *   service provider max (here: ServiceProviderConfig.filter.maxResults);
 *   negative count → 0; count 0 → only totalResults.
 * - §3.5.1  PUT: MUST NOT create (404 instead); returns 200 + full
 *   resource; required attributes (userName) MUST be present.
 * - §3.9  attributes/excludedAttributes projection, mutual exclusion.
 * - Table 8: 501 for unsupported operations (PATCH handler is swapped in
 *   at M3; the controller 501s until then). Sorting (§3.4.2.3) is not
 *   implemented in M2 → requests carrying sortBy reject with 501.
 */
import {
  invalidFilter,
  invalidSyntax,
  invalidValue,
  notFound,
  notImplemented,
  uniqueness,
} from '../core/errors/factories';
import { buildListResponse } from '../core/responses/list-response';
import { locationFor, metaFor, withResourceCommons } from '../core/meta/meta';
import type { ScimMeta } from '../core/types/common';
import { SCIM_USER_SCHEMA, ScimUser, ScimUserCreate, ScimUserResource } from '../core/types/user';
import type { ScimListResponse } from '../core/types/list';
import { projectScimResource } from '../core/attributes/attributes';
import type { ScimAttributeSelection } from '../core/attributes/attributes';
import type { ScimUserMapper, ScimUserService } from './spi';

/** Adapter-owned result of a single-resource flow. */
export interface AdapterResourceResult {
  resource: ScimUserResource;
  /** Fully-qualified location URI (RFC 7644 §3.3 Location header value). */
  location: string;
}

/** Options constructed by `ScimModule.forRoot()`. */
export interface ScimUserAdapterOptions<U> {
  userService: ScimUserService<U>;
  userMapper: ScimUserMapper<U>;
  /** Base path for Location/meta.location assembly (§3.1/§3.3). */
  basePath: string;
  /** List clamp — SHOULD mirror ServiceProviderConfig.filter.maxResults. */
  maxResultsPerPage: number;
}

/**
 * The WIRE query as sent by the HTTP layer — raw, untrusted, deliberately
 * `unknown`-valued. This is NOT the type the controllers consume; the
 * controllers receive {@link ParsedListQuery} via the pipe.
 */
export interface RawListQuery extends ScimAttributeSelection {
  startIndex?: unknown;
  count?: unknown;
  filter?: unknown;
  sortBy?: unknown;
  sortOrder?: unknown;
}

/**
 * The wire query AFTER `parseListQuery` — typed, normalized, RFC-verified
 * (§3.4.2.4 Table 6). This is the single shape `list`/`detail` consume:
 * interpretation happens here exactly once; the serving flows below are
 * pure over parsed input.
 */
export interface ParsedListQuery extends ScimAttributeSelection {
  /** Normalized 1-based index, default 1; garbage/negative → 1. */
  startIndex: number;
  /** Normalized size, default = provider maximum; negative → 0. */
  count: number;
  /**
   * Non-empty filter raw value — ALWAYS `undefined` in M2, because
   * `parseListQuery` rejects it with 400 invalidFilter (the M3 filter
   * pipeline replaces the rejection with actual parsing, filling this).
   */
  filter?: undefined;
  /**
   * ALWAYS `undefined` in M2 — presence of either → 501 notImplemented
   * (§3.4.2.3 sorting is not supported yet); M3+ may fill these.
   */
  sortBy?: undefined;
  sortOrder?: undefined;
  /** §3.4.2: envelope carries pagination attrs only when requested. */
  explicitStartIndex: boolean;
  /** §3.4.2: envelope carries pagination attrs only when requested. */
  explicitCount: boolean;
}

/** Payload guard: schemas attribute naming the core User (RFC 7644 §3.3). */
function assertUserPayload(rawPayload: unknown): ScimUserCreate {
  if (rawPayload === null || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw invalidSyntax({ detail: 'Request body must be a single JSON User resource.' });
  }
  const payload = rawPayload as Record<string, unknown>;
  const schemas = payload.schemas;
  if (!Array.isArray(schemas) || !schemas.includes(SCIM_USER_SCHEMA)) {
    throw invalidSyntax({
      detail: `Request body must declare "schemas" including ${SCIM_USER_SCHEMA}.`,
    });
  }
  if (typeof payload.userName !== 'string' || payload.userName.trim().length === 0) {
    throw invalidValue({ detail: 'A required value was missing or empty: "userName" (RFC 7643 §4.1.1).' });
  }
  // readOnly attributes (id/meta/groups) are ignored per §3.3 — nothing to
  // validate; the mapper receives the whole remaining payload untouched.
  return payload as unknown as ScimUserCreate;
}

/** Raw query scalars may arrive as string | string[] — take the first. */
function firstScalar(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function parseStartIndex(value: unknown): number {
  const raw = firstScalar(value);
  const parsed = raw === undefined ? NaN : Number(raw);
  // §3.4.2.4 Table 6: defaults to 1; "a value less than 1 SHALL be
  // interpreted as 1". Non-numeric garbage is treated as unspecified.
  if (raw === undefined || Number.isNaN(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function parseCount(value: unknown, maxResults: number): number {
  const raw = firstScalar(value);
  if (raw === undefined) return maxResults; // §3.4.2.4: provider-set maximum
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return maxResults;
  if (parsed < 0) return 0; // §3.4.2.4: negative SHALL be interpreted as 0
  return Math.min(Math.floor(parsed), maxResults);
}

/**
 * RFC 7644 §3.4 attribute-selection params, validated/normalized.
 * Non-string / comma-string forms are split exactly like wire clients send.
 */
function parseSelection(raw: Partial<RawListQuery>): ScimAttributeSelection {
  const selection = {
    attributes: firstList(raw.attributes),
    excludedAttributes: firstList(raw.excludedAttributes),
  };
  return selection;
}

function firstList(value: unknown): string[] | undefined {
  const raw = firstScalar(value);
  if (raw === undefined) return undefined;
  const items = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  return items.length > 0 ? items : undefined;
}

/**
 * Parsed query with nothing selected — the no-query convenience default
 * for `detail` (where startIndex/count play no role).
 */
export const EMPTY_PARSED_LIST_QUERY: ParsedListQuery = {
  startIndex: 1,
  count: 0,
  explicitStartIndex: false,
  explicitCount: false,
};

export class ScimUserAdapter<U = unknown> {
  constructor(private readonly o: ScimUserAdapterOptions<U>) {}

  /* ── Create — RFC 7644 §3.3 ─────────────────────────────────────────── */

  async create(rawPayload: unknown): Promise<AdapterResourceResult> {
    const payload = assertUserPayload(rawPayload);
    await this.assertUserNameFree(payload.userName);

    const domain = await this.o.userService.create(this.o.userMapper.fromScim(payload));
    return this.resourceResult(domain);
  }

  /* ── Detail — RFC 7644 §3.4.1 ───────────────────────────────────────── */

  async detail(id: string, parsed: ParsedListQuery = EMPTY_PARSED_LIST_QUERY): Promise<AdapterResourceResult> {
    const { resource, location } = await this.resourceFromId(id);
    return {
      location,
      resource: projectScimResource(resource, parsed),
    };
  }

  /* ── Replace — RFC 7644 §3.5.1 (PUT MUST NOT create) ─────────────────── */

  async replace(id: string, rawPayload: unknown): Promise<AdapterResourceResult> {
    const existing = await this.mustFind(id);
    const payload = assertUserPayload(rawPayload);

    // PUT conflicts: when the payload MOVES userName onto someone else's
    // spot, §3.3's duplicate-userName conflict rule applies for PUT too.
    const currentUserName = this.o.userMapper.toScim(existing).userName;
    if (payload.userName !== currentUserName) {
      await this.assertUserNameFree(payload.userName, id);
    }

    const domain = this.o.userMapper.fromScim(payload, existing);
    const updated = await this.o.userService.update(domain);
    return this.resourceResult(updated);
  }

  /* ── Delete — RFC 7644 §3.5.3 ───────────────────────────────────────── */

  async deleteResource(id: string): Promise<void> {
    await this.mustFind(id);
    await this.o.userService.deleteById(id);
  }

  /* ── List — RFC 7644 §3.4.2 (+3.4.2.4 pagination, 3.9 selection) ────── */

  /**
   * Wire → {@link ParsedListQuery}, the single interpretation point for
   * list/query-string inputs (parse, don't validate). Everything the
   * serving flows might get wrong about raw query-string values lives
   * here: coercion, clamping, §3.4.2.4 defaults, and unsupported-param
   * rejections (§3.4 filter → 400 invalidFilter, sorting → 501). Throws
   * ScimError synchronously — the controller pipe surfaces these through
   * the §3.12 exception filter unchanged.
   */
  parseListQuery(raw: unknown): ParsedListQuery {
    const rawQuery = (raw ?? {}) as Partial<RawListQuery>;

    // Filter → 400 while the M2 gate stands; M3 replaces the throw with
    // scim2-parse-filter evaluation (message kept stable for the wire).
    if (firstScalar(rawQuery.filter) !== undefined && rawQuery.filter !== '') {
      throw invalidFilter({
        detail: 'Filtering is not yet enabled on this service provider (planned for the next release).',
      });
    }
    // Sorting → 501, Table 8 ("does not support the request operation").
    if (
      firstScalar(rawQuery.sortBy) !== undefined ||
      firstScalar(rawQuery.sortOrder) !== undefined
    ) {
      throw notImplemented({
        detail: 'Sorting (sortBy/sortOrder) is not supported by this service provider.',
      });
    }

    return {
      ...parseSelection(rawQuery),
      startIndex: parseStartIndex(rawQuery.startIndex),
      count: parseCount(rawQuery.count, this.o.maxResultsPerPage),
      // Presence flags read the RAW record (key present ⇒ flagged), so a
      // garbage value still marks the query as explicitly paginated —
      // matching §3.4.2's "partial results" envelope semantics.
      explicitStartIndex: 'startIndex' in rawQuery,
      explicitCount: 'count' in rawQuery,
    };
  }

  async list(parsed: ParsedListQuery): Promise<ScimListResponse<ScimUserResource>> {
    const page = await this.o.userService.list({ startIndex: parsed.startIndex, count: parsed.count });
    const resources = page.items.map((domain) => this.resourceOf(domain));
    const projected = resources.map((resource) => projectScimResource(resource, parsed));

    // Pagination attrs REQUIRED whenever a page was explicitly requested
    // (§3.4.2: partial results) — builders derive the rest.
    const explicitlyPaged = parsed.explicitCount || parsed.explicitStartIndex;
    return buildListResponse({
      totalResults: page.totalResults,
      items: projected,
      startIndex: parsed.startIndex,
      paginated: explicitlyPaged ? true : undefined,
    });
  }

  /* ── Internals ──────────────────────────────────────────────────────── */

  private async mustFind(id: string): Promise<U> {
    const found = await this.o.userService.findById(id);
    if (found === null || found === undefined) {
      throw notFound({ detail: `User ${id} not found.` });
    }
    return found;
  }

  private async assertUserNameFree(userName: string, selfId?: string): Promise<void> {
    const row = await this.o.userService.findByUserName(userName);
    if (row !== null && row !== undefined) {
      if (selfId === undefined || this.o.userMapper.getId(row) !== selfId) {
        throw uniqueness({ detail: `"userName": "${userName}" is already in use or is reserved.` });
      }
    }
  }

  private async resourceFromId(id: string): Promise<AdapterResourceResult> {
    const domain = await this.mustFind(id);
    return this.resourceResult(domain);
  }

  /** Domain → complete wire resource (commons attached, password stripped). */
  private resourceResult(domain: U): AdapterResourceResult {
    const resource = this.resourceOf(domain);
    return { resource, location: resource.meta?.location ?? '' };
  }

  private resourceOf(domain: U): ScimUserResource {
    const id = this.o.userMapper.getId(domain);
    // writeOnly password MUST never leave the server (RFC 7643 §7.2:
    // "returned" never) even if a mapper mishandles it.
    const { password: _stripped, ...core } = this.o.userMapper.toScim(domain) as ScimUser & { password?: string };
    return withResourceCommons({ schemas: [SCIM_USER_SCHEMA], ...core }, { id, meta: this.metaFor(domain, id) });
  }

  private metaFor(domain: U, id: string): ScimMeta {
    const tracked = this.o.userMapper.getMeta?.(domain);
    return metaFor({
      resourceType: 'User',
      location: locationFor(this.o.basePath, 'Users', id),
      created: tracked?.created,
      lastModified: tracked?.lastModified,
      version: tracked?.version,
    });
  }
}
