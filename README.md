# nest-scim

> SCIM 2.0 (RFC 7643/7644) provisioning server library for NestJS, designed to sit next to your
> existing SAML/SSO setup. The library ships the protocol — the controller, the four SCIM
> endpoints, RFC 7644 PATCH semantics, filtering, pagination, and the SCIM error taxonomy — while
> you provide only your own storage (a small service interface) and a user mapper, wired through
> dependency injection.

## Status

In scaffolding (Milestone M0). See [docs/SCIM_SPEC.md](docs/SCIM_SPEC.md) for the full spec, the
architecture, the decisions log, and the milestone plan.

## Monorepo layout

```
packages/scim   # @nest-scim/core — the SCIM protocol library
docs/           # specs and project documentation
```

## Development

```bash
pnpm install     # install workspace dependencies
pnpm build       # build all packages
pnpm test        # run all package tests
pnpm lint        # eslint
pnpm format      # prettier
pnpm changeset   # record a change for the next release
```

## License

UNLICENSED for now — decided before the npm beta release (M5).
