# Errors

Protocol errors are returned as SCIM Error resources with `Content-Type: application/scim+json`. The response contains the SCIM error schema, a string status, a human-readable `detail`, and an optional `scimType` keyword.

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
  "status": "400",
  "scimType": "invalidFilter",
  "detail": "The specified filter syntax was invalid."
}
```

The library maps request and service outcomes to protocol status codes. Common cases include:

| Status | Example                                      | SCIM type                                                               |
| ------ | -------------------------------------------- | ----------------------------------------------------------------------- |
| `400`  | malformed filter or unsupported path         | `invalidFilter`, `invalidPath`, `invalidSyntax`, or another RFC keyword |
| `404`  | requested user does not exist                | —                                                                       |
| `409`  | `userName` or `externalId` is already in use | `uniqueness`                                                            |
| `501`  | unsupported sort request                     | —                                                                       |
| `500`  | unhandled application failure                | —                                                                       |

Use the exported error factories, such as `notFound`, `uniqueness`, and `invalidValue`, to report known conditions from your service. Do not expose credentials, tokens, or internal stack traces in `detail`.

The [error reference](/reference/errors) lists factory names and statuses. The global exception filter converts unexpected exceptions into a generic internal SCIM error.
