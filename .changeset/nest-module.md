---
'@nest-scim/core': minor
---

Add the NestJS SCIM module suite: `ScimModule.forRoot()` with dynamic Users +
discovery controllers (unguarded discovery; PATCH answers 501 per RFC 7644
Table 8 until PATCH lands), the framework-free `ScimUserService`/`ScimUserMapper`
SPI with DI tokens and the `@ScimUserMapperToken()` decorator, the resource
adapter (create/detail/replace/delete/list with §3.3 uniqueness, §3.5.1 strict
PUT replaces, §3.4.2.4 pagination, §3.9 attribute projection), the §3.12
exception filter writing `application/scim+json` responses on every adapter via
the cross-platform response writer, plus e2e lifecycle/error/guard corpora.
Runtime dependency surface stays `@nestjs/common` (plus optional
`reflect-metadata`) — HTTP-platform code remains the application's bootstrap.
