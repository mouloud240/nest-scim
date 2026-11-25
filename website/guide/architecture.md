# Architecture

The library owns SCIM protocol behavior. Your application owns domain data and the policy that controls access to it.

```text
Identity provider
      │  SCIM over HTTPS
      ▼
NestJS route + auth guard
      │
@nest-scim/core
  ├─ request validation and SCIM errors
  ├─ User CRUD and RFC 7644 PATCH
  ├─ filter compilation and pagination
  └─ discovery resources and response metadata
      │                         │
user service                 user mapper
      │                         │
repository / database  ⇄  your domain model
```

## Two application contracts

- **`ScimUserService<U>`** owns persistence: lookups, writes, deletes, and listing. It receives a normalized page request and returns page items plus the filter-scoped total.
- **`ScimUserMapper<U>`** owns translation between your model and the SCIM User resource. It also declares the domain paths used by filters.

`ScimModule.forRoot()` registers both classes in Nest's dependency-injection graph. The rest of the route, validation, error, and response flow stays inside the library.

## What the library does not own

Your app decides how identities map to existing accounts, how tokens are validated, how database transactions work, and how a `DomainFilter` maps to SQL, Prisma, or another store. The library does not evaluate filters by loading all rows into memory.

The first release focuses on SCIM User resources. Group provisioning, bulk operations, sorting, and change-password operations are not part of the current service-provider capability set. See [project status](/project/status).

## Request lifecycle

For a write, the adapter parses the SCIM payload, resolves any existing domain object, translates through the mapper, and calls the service. It then maps the returned object back to SCIM and adds server-managed `id` and `meta` values. For a list request, the filter is compiled using the mapper's `attributePathMap` before the service receives it.

Discovery routes (`/ServiceProviderConfig` and `/Schemas`) are unguarded by the module's `auth` option. User routes are guarded. If your deployment needs discovery protected, use a global Nest guard or another application-level control.

See the [SPI reference](/reference/spi) for method contracts and the [module options](/reference/module-options) for registration details.
