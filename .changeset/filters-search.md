---
'@nest-scim/core': minor
---

Add RFC 7644 §3.4.2.2 filtering and the §3.4.3 `POST /Users/.search` endpoint.
`?filter=` now parses through `scim2-parse-filter` behind a wrapper
(`parseScimFilter` throws 400 invalidFilter on syntax errors, strips core URN
prefixes from attrPaths, exports `ScimFilterExpression`). The adapter compiles
the AST through the mapper's `attributePathMap` into a typed `DomainFilter`
tree; the library never evaluates rows. The SPI
(`ScimUserServicePage.where?: DomainFilter`) hands implementations only their
own field paths, so filtering/counting runs in their store; `totalResults` MUST
be filter-scoped and a filtered set exceeding
`ServiceProviderConfig.filter.maxResults` fails as 400 tooMany (Table 9).
`POST /Users/.search` accepts the same parameters in SearchRequest body form
(400 invalidSyntax without the `SearchRequest` schema URN). Includes an
Entra/Okta filter fixture corpus as permanent e2e regression coverage. Adds
`scim2-parse-filter@^0.3.0` as a runtime dependency.
