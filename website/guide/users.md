# Users and mapping

The module exposes SCIM User operations under the configured `basePath`. The service works with your domain type; the mapper converts that type to and from SCIM resources.

## Resource identity

Your service assigns the durable id when creating a user. The mapper's `getId` returns that id as a string. The library uses it for the SCIM `id`, resource URL, and `Location` header. The mapper's `toScim` should return user attributes only; the library adds server-managed `id` and `meta` fields.

## Create and replace

`fromScim(scim, existing?)` handles both create and full replacement:

- On create, `existing` is absent. The service assigns and returns the id.
- On replacement, `existing` contains the current domain record. Return a complete replacement object, preserving application-owned state such as the database id.
- A missing SCIM attribute means the domain value is cleared. This strict-absence rule prevents stale values from surviving a full replacement.

The SCIM `password` attribute is write-only. Never include it in `toScim` responses or logs.

## Uniqueness

Before creating a user, the adapter checks `userName` and, when provided, `externalId` through `findByUserName` and `findByExternalId`. Return the matching user when found; otherwise return `null`. Conflicts are reported as `409 uniqueness`.

## Metadata

Implement optional `getMeta` to supply storage-backed `created`, `lastModified`, or `version` values. If omitted, the response still receives its resource type and location where applicable; unsupported metadata remains absent.

## List behavior

`list({ startIndex, count, where })` receives normalized pagination values. Return at most `count` matching items and the total matching `where` before pagination. If the request has no filter, `where` is absent.

See the [compiled mapper example](/guide/getting-started#implement-the-mapper), the [SPI reference](/reference/spi), and [filtering](/guide/filtering).

::: warning Strict replacement semantics
A missing attribute is cleared on `PUT`. If your domain model has fields that are not represented in SCIM, preserve those fields from `existing`; do not preserve absent SCIM attributes.
:::
