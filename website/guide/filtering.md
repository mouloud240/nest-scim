# Filtering

The library parses the SCIM `filter` expression, validates supported attributes, translates every path through `attributePathMap`, and passes a typed `DomainFilter` to your service. Your store applies it. The library never evaluates user rows in memory.

## Declare filterable paths

The mapper's map connects SCIM attribute paths to paths in your domain model:

```ts
attributePathMap = {
  userName: 'login',
  displayName: 'profile.name',
  active: 'enabled',
  emails: 'emailAddresses',
  'emails.value': 'emailAddresses.address',
  'emails.type': 'emailAddresses.kind',
};
```

Map keys are SCIM paths and are case-insensitive. Values are domain dot-paths. The map is validated at app bootstrap. An unmapped path rejects the filter with `400 invalidFilter`; there is no fallback evaluator. An empty map is valid and means the provider supports no filtering attributes.

## Translate the tree

For `?filter=userName eq "jensen@example.com"`, the service receives a comparison node whose path is `login`. Translate that node into your database query. The [store translation recipe](/recipes/store-filtering) outlines the semantics to preserve.

```ts
{
  op: 'eq',
  path: 'login',
  value: 'jensen@example.com',
  ignoreCase: true
}
```

`ne` is compiled as `pr AND NOT eq`, so it never appears as a `DomainFilter` operator. This preserves SCIM behavior for attributes that are absent.

## Semantics to preserve

- A comparison is false when its attribute is absent or empty.
- `pr` is true only for non-empty, non-null values.
- A value-path filter (`[]`) matches when one element satisfies the complete child filter. All child comparisons must match the same element.
- `not` is logical negation, including absent-attribute cases.
- `and` and `or` compose child filters normally.
- `ignoreCase` applies only to string comparisons whose SCIM schema is not case-exact.

SQL `NULL` needs explicit handling. For example, `not (displayName eq "Babs")` is true when `displayName` is absent under SCIM semantics; SQL's three-valued logic can otherwise omit that row.

## List contract

When `where` is present, your service must apply it to both the page rows and `totalResults`. The total is the count before pagination. The adapter enforces the provider's `filter.maxResults` ceiling and returns `400 tooMany` when a filtered result set exceeds it.

Read the full [DomainFilter reference](/reference/domain-filter) for each node shape and the [pagination guide](/guide/pagination) for page normalization.
