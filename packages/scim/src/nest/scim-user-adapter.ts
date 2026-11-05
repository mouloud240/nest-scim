/**
 * Resource adapter — the wire⇄SPI bridge the controllers route through.
 * All behavior cites docs/rfc/rfc7644.txt; decisions live in docs/SCIM_SPEC.md.
 *
 * create §3.3 · detail §3.4.1 · replace §3.5.1 · patch §3.5.2 ·
 * delete §3.5.3 · list §3.4.2 (+3.4.2.4, §3.9 selection) ·
 * Table 8: sortBy/sortOrder → 501; SPC `patch.supported:false` → PATCH 501s
 * before any SPI call.
 */
import {
  invalidFilter,
  invalidSyntax,
  invalidValue,
  mutability,
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
import { applyPatchRequest } from '../core/patch/apply';
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
  /** SPC mirror (RFC 7643 §5): false → every PATCH answers 501 before any SPI call (Table 8). */
  patchSupported?: boolean;
}

/** The wire query as sent — raw, untrusted, `unknown`-valued. */
export interface RawListQuery extends ScimAttributeSelection {
  startIndex?: unknown;
  count?: unknown;
  filter?: unknown;
  sortBy?: unknown;
  sortOrder?: unknown;
}

/**
 * The wire query after `parseListQuery` — typed, normalized per §3.4.2.4
 * Table 6; the single shape `list`/`detail` consume (interpretation lives
 * in the adapter exactly once). `filter`/`sortBy`/`sortOrder` are always
 * `undefined` today: non-empty filter → 400 invalidFilter, sorting → 501
 * (M4 fills `filter` with parse-filter output).
 */
export interface ParsedListQuery extends ScimAttributeSelection {
  /** Normalized 1-based index, default 1; garbage/negative → 1. */
  startIndex: number;
  /** Normalized size, default = provider maximum; negative → 0. */
  count: number;
  /** Always `undefined` until M4 (parseFilter fills it). */
  filter?: undefined;
  /** Always `undefined` until sorting is implemented. */
  sortBy?: undefined;
  sortOrder?: undefined;
  /** Envelope carries pagination attrs only when requested (§3.4.2). */
  explicitStartIndex: boolean;
  /** Envelope carries pagination attrs only when requested (§3.4.2). */
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
  // readOnly attrs (id/meta/groups) ignored per §3.3 — payload passes to the mapper whole.
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
  // §3.4.2.4 Table 6: default 1; values < 1 are also 1; garbage unspecified.
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

    // PUT-move onto someone else's userName → §3.3's conflict rule too.
    const currentUserName = this.o.userMapper.toScim(existing).userName;
    if (payload.userName !== currentUserName) {
      await this.assertUserNameFree(payload.userName, id);
    }

    const domain = this.o.userMapper.fromScim(payload, existing);
    const updated = await this.o.userService.update(domain);
    return this.resourceResult(updated);
  }

  /* ── Patch — RFC 7644 §3.5.2 (atomic; success = 200 + resource) ─────── */

  /**
   * Order: SPC gate (501) → mustFind (404) → body validation. Commons are
   * stripped before ops run and rebuilt by resourceResult (readOnly, §3.1)
   * — the engine applies ops on a clone, so a failing op aborts before the
   * single `update()` write (§3.5.2 atomicity, line 1931).
   *
   * Mapper round-trip (strict-absence): patching starts from the CURRENT
   * FULL projection, so a key absent after the sequence = "unassigned by
   * the ops" — the deletion signal `fromScim(scim, existing)` consumes.
   * Unassigning required userName → mutability (§3.5.2.2); moving it onto
   * another row → 409 uniqueness (Table 8, same rule as PUT).
   */
  async patch(
    id: string,
    rawBody: unknown,
    parsed: ParsedListQuery = EMPTY_PARSED_LIST_QUERY,
  ): Promise<AdapterResourceResult> {
    if (this.o.patchSupported === false) {
      throw notImplemented({ detail: 'PATCH is not supported by this service provider.' });
    }

    const existing = await this.mustFind(id);
    const current = this.resourceOf(existing);

    const { id: _roId, meta: _roMeta, ...patchable } = current;
    const patched = applyPatchRequest(patchable as unknown as Record<string, unknown>, rawBody);

    // userName is REQUIRED (§4.1.1) — unassignment fails with mutability.
    const nextUserName = patched.userName;
    if (
      nextUserName === undefined ||
      nextUserName === null ||
      (typeof nextUserName === 'string' && nextUserName.trim().length === 0)
    ) {
      throw mutability({ detail: 'The "userName" attribute is required and cannot be unassigned by a patch operation.' });
    }

    // userName MOVE onto another row → 409 (Table 8).
    if (nextUserName !== current.userName) {
      await this.assertUserNameFree(nextUserName as string, id);
    }

    const domain = this.o.userMapper.fromScim(
      { schemas: [SCIM_USER_SCHEMA], ...(patched as Record<string, unknown>) } as unknown as ScimUserCreate,
      existing,
    );
    const updated = await this.o.userService.update(domain); // the only write
    const result = this.resourceResult(updated);

    return {
      location: result.location,
      resource: projectScimResource(result.resource, parsed), // §3.9 selection
    };
  }

  /* ── Delete — RFC 7644 §3.5.3 ───────────────────────────────────────── */

  async deleteResource(id: string): Promise<void> {
    await this.mustFind(id);
    await this.o.userService.deleteById(id);
  }

  /* ── List — RFC 7644 §3.4.2 (+3.4.2.4 pagination, 3.9 selection) ────── */

  /**
   * The single interpretation point for raw query strings (parse, don't
   * validate): §3.4.2.4 coercion/clamping and the unsupported-param
   * rejections. Throws ScimError synchronously — the controller pipe
   * surfaces it through the §3.12 exception filter unchanged.
   */
  parseListQuery(raw: unknown): ParsedListQuery {
    const rawQuery = (raw ?? {}) as Partial<RawListQuery>;

    if (firstScalar(rawQuery.filter) !== undefined && rawQuery.filter !== '') {
      throw invalidFilter({
        detail: 'Filtering is not yet enabled on this service provider (planned for the next release).',
      });
    }
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
      // Presence flags read the RAW record: a garbage value still counts
      // as explicit pagination (§3.4.2 partial-results envelope).
      explicitStartIndex: 'startIndex' in rawQuery,
      explicitCount: 'count' in rawQuery,
    };
  }

  async list(parsed: ParsedListQuery): Promise<ScimListResponse<ScimUserResource>> {
    const page = await this.o.userService.list({ startIndex: parsed.startIndex, count: parsed.count });
    const resources = page.items.map((domain) => this.resourceOf(domain));
    const projected = resources.map((resource) => projectScimResource(resource, parsed));

    // §3.4.2: pagination attrs required when a page was explicitly requested.
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
    // writeOnly password MUST never leave the server (RFC 7643 §7.2) even
    // if a mapper mishandles it.
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
