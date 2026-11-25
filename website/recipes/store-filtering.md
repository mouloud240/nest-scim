# Translate filters for your store

`ScimUserService.list` receives a `DomainFilter` tree after SCIM paths have been mapped to your domain paths. Translate this tree to your query engine. Do not fetch every user and filter in application memory.

## A basic translation shape

This Prisma-style sketch shows the structural mapping. It is not a drop-in adapter; each database has different rules for nulls, arrays, case folding, and nested attributes.

```ts
function toPrisma(where: DomainFilter): Prisma.UserWhereInput {
  switch (where.op) {
    case 'and':
      return { AND: where.filters.map(toPrisma) };
    case 'or':
      return { OR: where.filters.map(toPrisma) };
    case 'not':
      return { NOT: toPrisma(where.filter) };
    case 'pr':
      return { [where.path]: { not: null } }; // refine for empty values
    case '[]':
      return { [where.path]: { some: toPrisma(where.itemFilter) } };
    case 'eq':
      return {
        [where.path]: where.ignoreCase
          ? { equals: where.value, mode: 'insensitive' }
          : { equals: where.value },
      };
    // Map co / sw / ew / gt / lt / ge / le for your schema.
  }
}
```

## Semantic traps

- **NULL and negation:** SCIM `not (x eq value)` is true when `x` is absent. SQL `NOT (x = value)` does not include SQL `NULL`; add an explicit null branch or use non-null columns.
- **`ne`:** it is compiled to `pr AND NOT eq`. No `ne` node reaches your service. Do not simplify this into `NOT (column = value)` because that changes absent-value behavior.
- **Presence:** `pr` treats empty string, array, and object as absent, not merely SQL `NOT NULL`.
- **Value paths:** `emails[type eq "work" and value co "example"]` means both conditions match the same email element. Nested paths inside `itemFilter` are relative to that element.
- **Case handling:** `ignoreCase` applies only to string comparisons. Do not lowercase numbers or booleans.
- **Totals:** apply the same filter to the page query and the count query. Return the total before pagination.

Read the [DomainFilter reference](/reference/domain-filter) for exact node shapes and the [pagination guide](/guide/pagination) for page parameters.
