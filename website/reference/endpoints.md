# Endpoints

All routes use the configured `basePath`, `/scim/v2` in the examples below. Responses use `application/scim+json`.

## User routes

| Method   | Path             | Behavior                                                     |
| -------- | ---------------- | ------------------------------------------------------------ |
| `GET`    | `/Users`         | List users; supports `filter`, `startIndex`, and `count`.    |
| `POST`   | `/Users`         | Create a user; returns `201`, resource body, and `Location`. |
| `GET`    | `/Users/{id}`    | Read one user.                                               |
| `PUT`    | `/Users/{id}`    | Replace all SCIM attributes; omitted attributes are cleared. |
| `PATCH`  | `/Users/{id}`    | Apply ordered RFC 7644 PatchOp operations.                   |
| `DELETE` | `/Users/{id}`    | Delete a user; returns `204` on success.                     |
| `POST`   | `/Users/.search` | Search using a SCIM SearchRequest body.                      |

The `auth` option attaches guards to these user routes only.

## Discovery routes

| Method | Path                     | Behavior                                   |
| ------ | ------------------------ | ------------------------------------------ |
| `GET`  | `/ServiceProviderConfig` | Advertise supported protocol capabilities. |
| `GET`  | `/Schemas`               | Return supported schema descriptors.       |
| `GET`  | `/Schemas/{schemaId}`    | Return one schema descriptor.              |

Discovery endpoints are unguarded by the module's `auth` option. The current schema set focuses on SCIM User. Group and ResourceType endpoints are not included.

## Request body parsing

Configure Nest's body parser to accept `application/scim+json` for request bodies. See the [getting started guide](/guide/getting-started#parse-scim-request-bodies).
