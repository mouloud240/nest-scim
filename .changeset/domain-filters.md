---
'@nest-scim/core': minor
---

**Domain filters: filtering translated to your store, never evaluated in the library.**

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
