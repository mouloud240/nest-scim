# nest-scim

> SCIM 2.0 (RFC 7643/7644) User provisioning server library for NestJS.

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

## Monorepo layout

```
packages/scim   # @nest-scim/core — the SCIM protocol library
docs/           # specs and project documentation
```

## Development

```bash
pnpm install     # install workspace dependencies
pnpm build       # build all packages
pnpm test        # run all package tests
pnpm lint        # eslint
pnpm format      # prettier
pnpm changeset   # record a change for the next release
```

## License

UNLICENSED — not yet published to npm.
