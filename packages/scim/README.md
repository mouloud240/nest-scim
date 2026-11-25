# @nest-scim/core

SCIM 2.0 User provisioning for NestJS. The library handles the protocol; your application supplies its user service and mapper.

## Install

```sh
npm install @nest-scim/core
```

Requires Node.js 20+ and supports NestJS 10 and 11.

## Start here

Read the [getting started guide](https://nest-scim.mouloud.foo/guide/getting-started) to register `ScimModule`, implement the two SPI contracts, and configure request-body parsing for `application/scim+json`.

The library provides User CRUD and search, discovery endpoints, RFC 7644 PATCH, filter compilation, pagination, and SCIM errors. Your service translates `DomainFilter` trees into queries for your own datastore.

- [Full documentation](https://nest-scim.mouloud.foo/)
- [API reference](https://nest-scim.mouloud.foo/reference/spi)
- [GitHub repository](https://github.com/mouloud240/nest-scim)
