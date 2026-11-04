---
'@nest-scim/core': minor
---

Add RFC 7644 §3.5.2 PATCH support: the `/Users/:id` PATCH route is now live,
driven by the `scim-patch` engine behind a protocol wrapper (`applyPatchRequest`,
`parsePatchOperations`, `applyPatchOperations`, `mapPatchEngineError` exports).
Wire semantics: body MUSTs (`schemas` PatchOp URN, `Operations` ≥ 1, remove
requires path → 400 noTarget), case-insensitive op normalization for
Entra/Okta payloads, sequential application with engine-side single-clone
atomicity (`mutateDocument: false`) — a failing op never reaches the store —
required-attribute unassignment → 400 mutability, userName moves → 409
uniqueness, and commit-once flows returning 200 + full resource with §3.9
attribute projection. Adds `patchSupported` (ServiceProviderConfig override
mirror; `false` answers Table 8 501 before any lookup) and an Entra/Okta patch
fixture corpus as permanent e2e regression assets. Pins `scim-patch@^0.9.2`
(≥ CVE-2026-48170 fix) as the first non-Nest runtime dependency;
`scim2-parse-filter` arrives transitively for the M4 filter pipeline.
