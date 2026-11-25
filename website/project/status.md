# Project status

`@nest-scim/core` is designed for SCIM 2.0 User provisioning in NestJS. The npm install command is:

```sh
npm install @nest-scim/core
```

This documentation is published alongside the package release. Check the [npm package page](https://www.npmjs.com/package/@nest-scim/core) for the current version and release notes.

## Current scope

The package provides User CRUD and search, discovery through `/ServiceProviderConfig` and `/Schemas`, RFC 7644 PATCH, filter parsing and domain-path mapping, pagination, SCIM response metadata, and typed error factories.

It currently does not provide Groups, Bulk, sort, ETag support, change-password operations, or a token issuer. The provider configuration advertises unsupported capabilities as unsupported.

## Before production

Review the package's release status and license on npm and in the repository. Secure the endpoint with HTTPS, validate credentials in your own guard, use a persistent store, and test the identity-provider mappings against a non-production tenant first.

See the [GitHub repository](https://github.com/mouloud240/nest-scim) for issues and the latest implementation state.
