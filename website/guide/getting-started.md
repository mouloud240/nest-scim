# Getting started

`@nest-scim/core` adds a SCIM 2.0 User provisioning API to a NestJS application. You provide a user service and a mapper; the library handles protocol routes, PATCH, filter parsing, pagination, and SCIM responses.

## Install

```sh
npm install @nest-scim/core
```

The package supports NestJS 10 and 11 and Node.js 20 or later. It has peer dependencies on `@nestjs/common` and `reflect-metadata`.

## Register the module

Configure a base path and register your two contracts. This example also mounts an authentication guard on `/Users` routes.

<<< @/snippets/scim.module.ts

The referenced service and mapper are normal Nest providers. Their dependencies must be available to the dynamic module through `imports` and `providers`.

## Implement the mapper

The mapper translates between your domain model and SCIM User attributes. Its `attributePathMap` declares the domain paths used by filters.

<<< @/snippets/user.mapper.ts

`fromScim` must return the complete domain object. When an attribute is absent from an incoming create or replacement payload, clear its domain value rather than retaining stale data. Preserve non-SCIM state such as the database id from `existing`.

## Implement the service

The service delegates persistence to your repository. `list` must apply `where` in the store and return a total scoped to that filter.

<<< @/snippets/user.service.ts

The sample repository below is intentionally a stub. Replace its methods with your database queries and translate the `DomainFilter` tree as shown in [Filtering](/guide/filtering).

<<< @/snippets/users.repository.ts

## Parse SCIM request bodies

SCIM requests use `application/scim+json`. Nest's default JSON parser may not parse that media type. When you disable the built-in parser, register a parser that accepts both regular JSON and SCIM JSON:

```ts
const app = await NestFactory.create(AppModule, { bodyParser: false });
app.useBodyParser('json', {
  type: ['application/json', 'application/scim+json'],
});
await app.listen(3000);
```

This setup is required for JSON request bodies such as `POST`, `PUT`, `PATCH`, and `POST /.search`. Responses are emitted as `application/scim+json`.

## Verify the service

With the app running, check discovery first:

```sh
curl -i http://localhost:3000/scim/v2/ServiceProviderConfig
```

Then create a user. Replace the token with credentials accepted by your guard:

```sh
curl -i http://localhost:3000/scim/v2/Users \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/scim+json' \
  -d '{
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
    "userName": "jensen@example.com",
    "displayName": "Babs Jensen",
    "active": true
  }'
```

A successful create returns `201 Created`, the SCIM resource, and a `Location` header. Continue with the [Users guide](/guide/users) or browse the [endpoint reference](/reference/endpoints).

## Next

- [Architecture](/guide/architecture) — understand the boundary between the library and your app.
- [Authentication](/guide/authentication) — protect provisioning routes.
- [Configuration reference](/reference/module-options) — all module options.
