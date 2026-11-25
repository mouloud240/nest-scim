# Pagination

List requests use the SCIM `startIndex` and `count` parameters. `startIndex` is one-based. The adapter supplies concrete, normalized values to `ScimUserService.list`.

## Defaults and limits

- `startIndex` defaults to `1`.
- `count` defaults to the provider's `filter.maxResults` value, which is `200` by default.
- The requested page size is clamped to the provider ceiling.
- `count=0` requests only the total, with no resources in the page.
- `sortBy` and `sortOrder` are not supported and return `501 Not Implemented`.

You can change the provider ceiling through `serviceProviderConfig.filter.maxResults`.

## Service response

Return `items` for the requested page and `totalResults` for the entire result set. If `where` is present, both values must be scoped to that filter. Do not return only the page length as the total.

The adapter builds the SCIM `ListResponse`, including `Resources`, `totalResults`, `itemsPerPage`, and `startIndex` as appropriate. For a filtered result set larger than `filter.maxResults`, it returns `400 tooMany` rather than silently truncating the total.

```ts
list = async ({ startIndex, count, where }: ScimUserServicePage) => {
  const query = translateFilter(where);
  const [items, totalResults] = await Promise.all([
    users.findMany({ where: query, skip: startIndex - 1, take: count }),
    users.count({ where: query }),
  ]);
  return { items, totalResults };
};
```

The query above is illustrative; adapt pagination and filter translation to your storage engine. See [Filtering](/guide/filtering) and the [SPI reference](/reference/spi).
