/**
 * The resource SPI — the ONLY two contracts an application implements to
 * get a full SCIM 2.0 User endpoint suite.
 *
 * Framework-free on purpose: `@nestjs/common` never leaks into these
 * interfaces, so the same classes are reusable outside Nest (CLI seeding,
 * queue workers). DI wiring happens in `ScimModule.forRoot()` via the
 * `SCIM_USER_SERVICE` / `SCIM_USER_MAPPER` tokens.
 *
 * Division of responsibility (docs/SCIM_SPEC.md D6–D8):
 * - the SERVICE owns persistence and identity (RFC 7644 §1: the service
 *   provider manages the resource store),
 * - the MAPPER owns attribute translation — it is the only component that
 *   knows both shapes, mapping SCIM ⇄ domain with strict absence
 *   semantics: an attribute ABSENT from a SCIM payload means the
 *   corresponding domain field is CLEARED (RFC 7644 §3.5.1 PUT semantics
 *   — replaced representations are complete),
 * - the LIBRARY owns endpoints, wire validation, error taxonomy,
 *   meta/Location and pagination (RFC 7644 §3).
 */
import type { Page } from '../core/types/list';
import type { ScimUser, ScimUserCreate } from '../core/types/user';

/**
 * Page normalization contract handed to {@link ScimUserService.list}: the
 * adapter applies RFC 7644 §3.4.2.4 defaults BEFORE calling the service,
 * so implementations always receive concrete, clamped values.
 */
export interface ScimUserServicePage {
  /** 1-based index of the first requested row (NOT an offset). */
  startIndex: number;
  /** Requested page size, already clamped (0 means "no rows, total only"). */
  count: number;
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
export interface ScimUserService<U> {
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

  /** Persists a complete replacement (PUT) or mutated copy (PATCH, M3). */
  update(user: U): Promise<U>;

  /** Removes the user; adapter 404s beforehand when `findById` is null. */
  deleteById(id: string): Promise<void>;

  /**
   * Serves one normalized page (§3.4.2.4): return `items` (≤ count rows,
   * starting at startIndex) plus `totalResults` — the filter-ignoring
   * total the ListResponse envelope MUST report (§3.4.2).
   */
  list(page: ScimUserServicePage): Promise<Page<U>>;
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
  /** Extracts the provider-assigned id from a domain object. */
  getId(domain: U): string;

  /** SCIM payload (create or full-replace) ⇄ complete domain object. */
  fromScim(scim: ScimUserCreate, existing?: U): U;

  /** Domain object ⇄ complete SCIM representation (no id/meta/password). */
  toScim(domain: U): ScimUser;
}
