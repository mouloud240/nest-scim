# Error reference

All factories return `ScimError`. Pass optional `{ detail, cause }` to override the default message and retain an underlying cause. The exception filter serializes SCIM errors using RFC 7644's Error schema.

| Export           | HTTP status | `scimType`      |
| ---------------- | ----------: | --------------- |
| `invalidFilter`  |         400 | `invalidFilter` |
| `tooMany`        |         400 | `tooMany`       |
| `noTarget`       |         400 | `noTarget`      |
| `invalidValue`   |         400 | `invalidValue`  |
| `invalidSyntax`  |         400 | `invalidSyntax` |
| `invalidPath`    |         400 | `invalidPath`   |
| `invalidVers`    |         400 | `invalidVers`   |
| `sensitive`      |         400 | `sensitive`     |
| `mutability`     |         400 | `mutability`    |
| `uniqueness`     |         409 | `uniqueness`    |
| `notFound`       |         404 | omitted         |
| `notImplemented` |         501 | omitted         |
| `internal`       |         500 | omitted         |

Example from a service:

```ts
import { notFound, uniqueness } from '@nest-scim/core';

const existing = await users.findByUserName(userName);
if (existing) throw uniqueness({ detail: 'That userName is already provisioned.' });

const user = await users.findById(id);
if (!user) throw notFound({ detail: 'User does not exist.' });
```

Avoid returning sensitive internal details to the identity provider. The `cause` can preserve diagnostic context for application-side logging, but credentials and tokens should never enter error messages.

See the [errors guide](/guide/errors) and the [factory implementation](https://github.com/mouloud240/nest-scim/blob/master/packages/scim/src/core/errors/factories.ts).
