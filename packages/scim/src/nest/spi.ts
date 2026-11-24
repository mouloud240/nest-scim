/**
 * The resource SPI — the ONLY two contracts an application implements to
 * get a full SCIM 2.0 User endpoint suite. Framework-free by design: the
 * same classes stay reusable outside Nest; DI wiring happens in
 * `ScimModule.forRoot()` via the SCIM_USER_SERVICE / SCIM_USER_MAPPER tokens.
 *
 * Division (docs/SCIM_SPEC.md D6–D8): the SERVICE owns persistence and
 * identity; the MAPPER owns attribute translation with strict-absence
 * semantics (an attribute absent from a SCIM payload CLEARS the domain
 * field — RFC 7644 §3.5.1); the library owns endpoints, validation, error
 * taxonomy, meta/Location and pagination (§3).
 */
import type { Page } from '../core/types/list';
import type { DomainFilter } from '../core/filters/domain-filter';
import type { ScimUser, ScimUserCreate } from '../core/types/user';

/** SCIM attrPath → the application's domain dot-path (case-insensitive keys). */
export type AttributePathMap = Readonly<Record<string, string>>;

/**
 * Page normalization contract handed to {@link ScimUserService.list}: the
 * adapter applies RFC 7644 §3.4.2.4 defaults BEFORE calling the service,
 * so implementations always receive concrete, clamped values.
 *
 * When `where` is present the implementation MUST translate that tree to
 * its own store/idiom and scope `totalResults` to it — the library never
 * evaluates rows. The adapter enforces the provider ceiling (`tooMany`)
 * on the returned total.
 */
export interface ScimUserServicePage<P extends string = string> {
  /** 1-based index of the first requested row (NOT an offset). */
  startIndex: number;
  /** Requested page size, already clamped (0 means "no rows, total only"). */
  count: number;
  /** Compiled §3.4.2.2 filter; present only when the request carried one. */
  where?: DomainFilter<P>;
}

/**
 * Persistence SPI for User resources (RFC 7644 §1 §3.1–§3.5 flow control:
 * the library drives WHEN each call happens; implementations own HOW).
 * All methods operate on the application's OWN domain type; the adapter
 * translates at the wire boundary via {@link ScimUserMapper}.
 *
 * Identity note: uniqueness pre-checks (§3.3 create; §4.1.1 userName
 * uniqueness) require the two `find*` lookups — when your store enforces
 * them itself, `throw` still maps to `409 uniqueness` if you surface the
 * conflict via `ScimError` BEFORE the adapter round-trips.
 */
export interface ScimUserService<U, P extends string = string> {
  /** Fetches one user by the provider-assigned `id`; null ⇒ 404 notFound. */
  findById(id: string): Promise<U | null>;

  /**
   * Fetch by unique `userName` (RFC 7643 §4.1.1: unique across the whole
   * User set). Used by the adapter's create-time 409 uniqueness check.
   */
  findByUserName(userName: string): Promise<U | null>;

  /**
   * Fetch by `externalId` (RFC 7644 §3.3: the service provider MUST check
   * uniqueness of every externally-owned identifier at creation).
   */
  findByExternalId(externalId: string): Promise<U | null>;

  /**
   * Persists a fresh user mapped via `fromScim` — the implementation
   * assigns the durable `id`; the returned object MUST carry it (read
   * back through `mapper.getId`).
   */
  create(user: U): Promise<U>;

  /**
   * Persists a complete replacement (PUT) or a mutated copy (PATCH).
   * Assumed all-or-nothing: the adapter treats this as the only write of
   * the flow — a half-applied failure inside it is the implementation's.
   */
  update(user: U): Promise<U>;

  /** Removes the user; adapter 404s beforehand when `findById` is null. */
  deleteById(id: string): Promise<void>;

  /**
   * Serves one normalized page (§3.4.2.4): return `items` (≤ count rows,
   * starting at startIndex, all matching `where` when present) plus
   * `totalResults` — the filter-scoped total the ListResponse envelope
   * MUST report (§3.4.2), BEFORE the adapter clamps or applies the
   * provider ceiling.
   */
  list(page: ScimUserServicePage<P>): Promise<Page<U>>;
}

/**
 * Optional per-resource timestamp/ETag carrier handed to the adapter via
 * {@link ScimUserMapper.getMeta}. RFC 7643 §3.1: `meta` sub-attributes are
 * server-assigned readOnly values — the SPI simply asks YOUR store whether
 * it tracks them; anything left undefined stays out of the response
 * (`metaFor` omission semantics).
 */
export interface ScimUserMeta {
  created?: Date;
  lastModified?: Date;
  /** ETag-ish version token, e.g. W/"3694e05e9dff590". */
  version?: string;
}

/**
 * Attribute translation SPI. Generic over the application's domain type.
 *
 * `fromScim` is called for BOTH creates (no `existing`) and replaces
 * (with `existing`) — returning a COMPLETE domain object either way:
 * strict absence semantics apply, i.e. a SCIM attribute missing from the
 * payload clears the corresponding domain field. Preserve helper state
 * (hence `existing`) but never keep stale attribute values.
 *
 * `toScim` returns a complete `ScimUser` WITHOUT server-managed commons
 * (`id`/`meta` — the library adds those, RFC 7643 §3.1); writeOnly
 * `password` MUST never appear in it.
 */
export interface ScimUserMapper<U> {
  /**
   * REQUIRED — SCIM attrPath (core-relative, case-insensitive) → the domain
   * dot-path holding that value. Filtering only: `toScim` remains the full
   * translation contract, and this map MUST mirror its read paths. An empty
   * map declares "this provider supports no filters" (filters → 400).
   */
  attributePathMap: AttributePathMap;

  /** Extracts the provider-assigned id from a domain object. */
  getId(domain: U): string;

  /** SCIM payload (create or full-replace) ⇄ complete domain object. */
  fromScim(scim: ScimUserCreate, existing?: U): U;

  /** Domain object ⇄ complete SCIM representation (no id/meta/password). */
  toScim(domain: U): ScimUser;

  /**
   * OPTIONAL— supply your store's managed timestamps/ETag so the resource
   * `meta` is real rather than omitted. Not provided ⇒ `meta` carries
   * only `resourceType` + `location` (both OPTIONAL per RFC 7643 §3.1).
   */
  getMeta?(domain: U): ScimUserMeta;
}
