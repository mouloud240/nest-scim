# @nest-scim/core

## 0.0.0

### Minor Changes

- beaef38: **Domain filters: filtering translated to your store, never evaluated in the library.**

  `ScimUserMapper` now requires an `attributePathMap` (SCIM attrPath → your domain
  dot-path; case-insensitive keys). The adapter parses `?filter=`, then compiles it
  into a typed `DomainFilter` tree whose `path`s are your field paths — passed to
  `ScimUserService.list({ where })`. The library no longer ships an in-memory
  evaluator (`matches()` is removed), and no ORM/SQL adapters are required or
  provided: each store translates the tree to its own dialect.

  Contract highlights:

  - `DomainFilter` nodes: comparison (`eq/co/sw/ew/gt/lt/ge/le` + `ignoreCase`),
    `pr`, value path `[]` with a relative same-element `itemFilter`, `and`/`or`,
    `not`. `ne` is desugared to `pr AND NOT eq` so NULL semantics stay explicit.
  - Unmapped attributes and unsupported operator/type combinations (complex or
    multi-valued comparisons, value paths on scalars, nested value paths, range
    ops on boolean/binary) → 400 `invalidFilter`; there is no fallback. An empty
    map is legal and declares "no filtering supported".
  - The map is validated at bootstrap (`ScimModule.forRoot` wiring); malformed
    keys/values fail app init with `ScimModuleConfigError`.
  - `pr` follows RFC 7644 Table 3: non-empty/non-null; empty arrays/strings/
    objects are absent. `totalResults` remains filter-scoped, and the `tooMany`
    ceiling applies to the compiled `where`.

  Migration: add `attributePathMap` to your mapper (it must mirror the read paths
  `toScim` uses) and replace `page.filter.matches(...)` in `list()` with a
  translation of `page.where`. See the README section "Filtering against your own
  store" for per-operator semantics, NULL traps, and a store-side sketch.

- fc4882d: Add RFC 7644 §3.4.2.2 filtering and the §3.4.3 `POST /Users/.search` endpoint.
  `?filter=` now parses through `scim2-parse-filter` behind a wrapper
  (`parseScimFilter` throws 400 invalidFilter on syntax errors, strips core URN
  prefixes from attrPaths, exports `ScimFilterExpression`). The adapter compiles
  the AST through the mapper's `attributePathMap` into a typed `DomainFilter`
  tree; the library never evaluates rows. The SPI
  (`ScimUserServicePage.where?: DomainFilter`) hands implementations only their
  own field paths, so filtering/counting runs in their store; `totalResults` MUST
  be filter-scoped and a filtered set exceeding
  `ServiceProviderConfig.filter.maxResults` fails as 400 tooMany (Table 9).
  `POST /Users/.search` accepts the same parameters in SearchRequest body form
  (400 invalidSyntax without the `SearchRequest` schema URN). Includes an
  Entra/Okta filter fixture corpus as permanent e2e regression coverage. Adds
  `scim2-parse-filter@^0.3.0` as a runtime dependency.
- 5dcf0ac: Add the NestJS SCIM module suite: `ScimModule.forRoot()` with dynamic Users +
  discovery controllers (unguarded discovery; PATCH answers 501 per RFC 7644
  Table 8 until PATCH lands), the framework-free `ScimUserService`/`ScimUserMapper`
  SPI with DI tokens and the `@ScimUserMapperToken()` decorator, the resource
  adapter (create/detail/replace/delete/list with §3.3 uniqueness, §3.5.1 strict
  PUT replaces, §3.4.2.4 pagination, §3.9 attribute projection), the §3.12
  exception filter writing `application/scim+json` responses on every adapter via
  the cross-platform response writer, plus e2e lifecycle/error/guard corpora.
  Runtime dependency surface stays `@nestjs/common` (plus optional
  `reflect-metadata`) — HTTP-platform code remains the application's bootstrap.
- bf8b2b3: Add RFC 7644 §3.5.2 PATCH support: the `/Users/:id` PATCH route is now live,
  driven by the `scim-patch` engine behind a protocol wrapper (`applyPatchRequest`,
  `parsePatchOperations`, `applyPatchOperations`, `mapPatchEngineError` exports).
  Wire semantics: body MUSTs (`schemas` PatchOp URN, `Operations` ≥ 1, remove
  requires path → 400 noTarget), case-insensitive op normalization for
  Entra/Okta payloads, sequential application with engine-side single-clone
  atomicity (`mutateDocument: false`) — a failing op never reaches the store —
  required-attribute unassignment → 400 mutability, userName moves → 409
  uniqueness, and commit-once flows returning 200 + full resource with §3.9
  attribute projection. Adds `patchSupported` (ServiceProviderConfig override
  mirror; `false` answers Table 8 501 before any lookup) and an Entra/Okta patch
  fixture corpus as permanent e2e regression assets. Pins `scim-patch@^0.9.2`
  (≥ CVE-2026-48170 fix) as the first non-Nest runtime dependency;
  `scim2-parse-filter` arrives transitively for the M4 filter pipeline.
- 138bde3: Add the SCIM 2.0 protocol core: error taxonomy (RFC 7644 §3.12), core User
  resource types, meta/Location utilities, ListResponse builder, the RFC-verbatim
  User schema descriptor for /Schemas, and ServiceProviderConfig with RFC
  defaults plus user overrides. Framework-free groundwork for the M2 controller.
