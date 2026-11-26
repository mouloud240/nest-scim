# nest-scim

> SCIM 2.0 (RFC 7643/7644) User provisioning server library for NestJS.

[![npm version](https://img.shields.io/npm/v/@nest-scim/core?color=006ac5&logo=npm&logoColor=white)](https://www.npmjs.com/package/@nest-scim/core)
[![npm downloads](https://img.shields.io/npm/dm/@nest-scim/core?color=006ac5&logo=npm&logoColor=white)](https://www.npmjs.com/package/@nest-scim/core)

**[Documentation and quickstart →](https://nest-scim.mouloud.foo/)** · [npm package](https://www.npmjs.com/package/@nest-scim/core) · [GitHub](https://github.com/mouloud240/nest-scim)

```sh
npm install @nest-scim/core
```

## What it does

`@nest-scim/core` turns an existing SAML/SSO-enabled NestJS application into a SCIM 2.0 User
provisioning server, so identity providers like Okta, Entra ID, OneLogin, or Salesforce can
create, update, and delete your users automatically.

The library owns the **entire protocol**:

- `ScimModule.forRoot()` with a configurable base path and a Guard SPI for Bearer auth
- The four standard controller endpoints: `/ServiceProviderConfig`, `/Users`, and `/Schemas`
- Full RFC 7644 PATCH semantics (applied sequentially and atomically by the library)
- SCIM attribute filtering (`eq/ne/co/sw/ew/pr`, `and/or/not`) and pagination
- The SCIM error taxonomy, ListResponse envelope, and discovery documents

You own **only your data**, through two small dependency-injection contracts:

- A **user service** (`SCIM_USER_SERVICE`): fetch, save, and list users against any storage
- A **user mapper** (`@ScimUserMapperToken()`): `toScim` / `fromScim` between your domain
  model and the SCIM schema

No protocol plumbing in user code — storage + mapping is all you write.

## Filtering against your own store

`?filter=` is parsed and compiled by the library, then handed to your service as
a typed `DomainFilter` tree. Every attrPath is translated through your mapper's
`attributePathMap`, so the tree contains only **your** field paths — no SCIM
names, no SQL, and no in-memory evaluation in the library.

```ts
@ScimUserMapperToken()
class UserMapper implements ScimUserMapper<User> {
  // Required. Unmapped attrs reject the filter as 400 invalidFilter.
  attributePathMap = {
    userName: 'login',
    displayName: 'profile.name',
    userType: 'role',
    emails: 'emails',
    'emails.value': 'emails.address',
    'emails.type': 'emails.kind',
  };

  getId = (user: User) => user.id;
  toScim = (user: User) => /* … */;
  fromScim = (scim: ScimUserCreate) => /* … */;
}
```

`userService.list({ startIndex, count, where })` receives the tree:

```ts
// where?: DomainFilter — one of:
// { op: 'eq'|'co'|'sw'|'ew'|'gt'|'lt'|'ge'|'le', path, value, ignoreCase }
// { op: 'pr', path }
// { op: '[]', path, itemFilter }          // one element must match itemFilter
// { op: 'and'|'or', filters }
// { op: 'not', filter }
```

Translate it in your store. Prisma-shaped sketch (illustrative — not shipped):

```ts
function toPrisma(where: DomainFilter): Prisma.UserWhereInput {
  switch (where.op) {
    case 'and':
      return { AND: where.filters.map(toPrisma) };
    case 'or':
      return { OR: where.filters.map(toPrisma) };
    case 'not':
      return { NOT: toPrisma(where.filter) };
    case 'pr':
      return { [where.path]: { not: null } }; // refine per column
    case '[]':
      return { [where.path]: { some: toPrisma(where.itemFilter) } };
    case 'eq':
      return {
        [where.path]: where.ignoreCase
          ? { equals: where.value, mode: 'insensitive' }
          : { equals: where.value },
      };
    // …co/sw/ew/gt/lt/ge/le
  }
}
```

### Semantics your translation must preserve

| Node         | Meaning                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| comparison   | false when the attribute is unassigned; `ignoreCase` folds strings only |
| `pr`         | value is non-empty/non-null; an empty string/array/object is absent     |
| `[]`         | at least one element satisfies the whole `itemFilter` (same element)    |
| `not`        | logical negation, including absent-attribute cases                      |
| `and` / `or` | boolean composition                                                     |

`ne` never reaches you: compile desugars it to `pr AND NOT eq`, so a naive
`NOT (col = ?)` cannot silently drop NULL rows.

### Traps to handle in your dialect

- SQL `NOT` and NULL: in SCIM, `not eq` is true for an absent value. Translate
  with an explicit `IS NULL OR …` branch, or make columns non-null.
- `not emails[…]` means "no element matches" (`none` in Prisma), which is not
  the same as dropping rows whose array is empty.
- Value-path item paths are relative to one element (`kind`, not
  `emails.kind`).
- `totalResults` MUST be scoped to `where`; the adapter clamps pages and
  rejects filtered sets above `ServiceProviderConfig.filter.maxResults`
  (400 `tooMany`).
- An attrPath absent from `attributePathMap` rejects the whole request as 400
  `invalidFilter` — there is no fallback evaluator. An empty map is legal and
  means "this provider supports no filtering".

The map is validated at bootstrap: malformed keys/values fail app init, not
the first request.

## Monorepo layout

```
packages/scim   # @nest-scim/core — the SCIM protocol library
website/        # VitePress landing page and user documentation
docs/           # local specs and project planning notes (not published)
```

## Development

```bash
pnpm install     # install workspace dependencies
pnpm build       # build all packages
pnpm test        # run all package tests
pnpm lint        # oxlint
pnpm --filter @nest-scim/website docs:dev    # run the docs site
pnpm --filter @nest-scim/website docs:build  # build docs + type-check snippets
pnpm format      # prettier
pnpm changeset   # record a change for the next release
```

## Release

The package is prepared for its first stable release as `1.0.0`. Future package changes should include a Changesets entry. Merging to `master` creates or updates the version pull request; merging that PR verifies, packs, publishes, and creates a GitHub Release.

The npm package is scoped as `@nest-scim/core` under the `@nest-scim` organization. The first release is published manually to bootstrap the package; after that, configure npm Trusted Publishing for GitHub owner `mouloud240`, repository `nest-scim`, workflow `release.yml`, and environment `npm`. Later releases use OIDC, so no long-lived npm token is stored in GitHub.

Enable **Allow GitHub Actions to create and approve pull requests** in the repository's Actions settings so Changesets can open its version PR.

## License

MIT. See [LICENSE](LICENSE).
