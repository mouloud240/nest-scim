# PATCH

The library applies RFC 7644 §3.5.2 operations in order and persists the resulting user as one update. Your service receives one final `update` call for the PATCH request.

## Supported operations

A request uses the SCIM PatchOp schema and an ordered `Operations` array:

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
  "Operations": [
    { "op": "replace", "path": "displayName", "value": "Babs Jensen" },
    { "op": "add", "path": "active", "value": false },
    { "op": "remove", "path": "title" }
  ]
}
```

Operations support `add`, `replace`, and `remove`, with or without a path where the RFC allows it. Value-path expressions for multi-valued attributes are evaluated against the current resource. Operations later in the array observe earlier changes.

## Atomicity boundary

The library computes the patched representation before calling `update`. It does not write after each operation. Your service should make that single update atomic in the backing store. If the store update fails partway, transaction handling belongs to your persistence layer.

## Errors

Invalid operation structure and paths are returned as SCIM errors, including `invalidSyntax`, `invalidPath`, `noTarget`, and `invalidValue` where applicable. A request to an operation the provider does not support can return `501 Not Implemented`.

PATCH support is advertised through `ServiceProviderConfig.patch.supported` and defaults to `true`. If you override it to `false`, the module reports PATCH as unsupported.

See the [endpoint list](/reference/endpoints) and [error reference](/reference/errors).
