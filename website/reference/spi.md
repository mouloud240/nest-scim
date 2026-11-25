# SPI contracts

The module asks your application for two classes: a service that owns domain persistence and a mapper that translates the domain model to and from SCIM User resources.

## `ScimUserService<U>`

```ts
interface ScimUserService<U, P extends string = string> {
  findById(id: string): Promise<U | null>;
  findByUserName(userName: string): Promise<U | null>;
  findByExternalId(externalId: string): Promise<U | null>;
  create(user: U): Promise<U>;
  update(user: U): Promise<U>;
  deleteById(id: string): Promise<void>;
  list(page: ScimUserServicePage<P>): Promise<Page<U>>;
}
```

Lookups return `null` when no record exists. `create` assigns and returns the durable id. `update` persists a complete replacement or patched copy. `list` returns no more than `count` matching rows and a total before pagination; the total must reflect `where` when present.

`ScimUserServicePage` has normalized `startIndex` (one-based), `count` (possibly zero), and optional `where: DomainFilter<P>`.

## `ScimUserMapper<U>`

```ts
interface ScimUserMapper<U> {
  attributePathMap: Readonly<Record<string, string>>;
  getId(domain: U): string;
  fromScim(scim: ScimUserCreate, existing?: U): U;
  toScim(domain: U): ScimUser;
  getMeta?(domain: U): ScimUserMeta;
}
```

`attributePathMap` is required. An empty map disables filterable attributes. Keys are SCIM paths and values are your domain paths. It is used for filter compilation; it does not replace `toScim` or `fromScim`.

`fromScim` returns a complete domain object for create and replacement. Missing SCIM attributes clear their mapped domain values. Preserve application-owned fields from `existing` where appropriate. `toScim` must not include server-owned `id` or `meta`, or the write-only `password`.

`getMeta` may return storage-backed timestamps or a version token. When absent, optional metadata is omitted.

## Mapper decorator

`@ScimUserMapperToken()` marks a mapper class for the package's mapper marker. It is recommended but not required by `ScimModule.forRoot()`.

## Related exports

- `AttributePathMap`
- `ScimUserMeta`
- `Page<U>`
- `DomainFilter<P>`
- `SCIM_USER_SERVICE` and `SCIM_USER_MAPPER` DI tokens

See the source definitions in [`spi.ts`](https://github.com/mouloud240/nest-scim/blob/master/packages/scim/src/nest/spi.ts) and the [getting started example](/guide/getting-started).
