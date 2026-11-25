# DomainFilter

`DomainFilter<P>` is a discriminated union passed to `ScimUserService.list`. Paths are domain paths resolved from `attributePathMap`. The library parses and compiles the expression; your persistence layer translates the tree.

## Node shapes

### Comparison

```ts
{
  op: 'eq' | 'co' | 'sw' | 'ew' | 'gt' | 'lt' | 'ge' | 'le';
  path: P;
  value: string | number | boolean | null;
  ignoreCase: boolean;
}
```

`ne` is not emitted. It is desugared to a presence check combined with negated equality.

### Presence

```ts
{
  op: 'pr';
  path: P;
}
```

`pr` means that the value is assigned and non-empty. Empty strings, arrays, and objects are absent.

### Value path

```ts
{
  op: '[]';
  path: P;
  itemFilter: DomainFilter<P>;
}
```

The container path points to a multi-valued attribute. Child paths are relative to one element. At least one element must satisfy the entire `itemFilter`.

### Boolean nodes

```ts
{
  op: 'and' | 'or';
  filters: DomainFilter < P > [];
}
{
  op: 'not';
  filter: DomainFilter<P>;
}
```

## Store semantics

- Comparisons are false for absent values.
- `ignoreCase` folds strings only.
- `not` is logical negation, so negating a false comparison is true even when the value is absent.
- `[]` requires one same-element match, not independent matches across two array entries.
- SQL `NULL` behavior must be handled explicitly to preserve those rules.
- `totalResults` must use the same filter as the returned rows.

See the [filtering guide](/guide/filtering) and the [store translation recipe](/recipes/store-filtering). Source: [`domain-filter.ts`](https://github.com/mouloud240/nest-scim/blob/master/packages/scim/src/core/filters/domain-filter.ts).
