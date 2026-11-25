# Product

## Register

brand

## Users

NestJS backend engineers and tech leads at B2B SaaS companies who have just been told "make us SCIM-compliant" by an Okta or Microsoft Entra ID administrator. They are at their desk, evaluating libraries before a sprint, then implementing under a deadline. They know NestJS and TypeScript well; they do not want to read RFC 7644 end to end, but they need to trust that someone did.

## Product Purpose

`@nest-scim/core` turns an existing NestJS application into a compliant SCIM 2.0 User provisioning server. It owns the protocol — endpoints, PATCH semantics, filters, pagination, discovery, errors, media types — and asks the application for exactly two things: a persistence service and a mapper. Success means a working `/Users` endpoint that Okta and Entra ID accept, written in an afternoon, with no protocol code in the user's repository.

## Brand Personality

Precise, calm, infrastructural. The voice is direct and technical: exact status codes, RFC section numbers, real requests. Confidence comes from specificity, not adjectives. The site should feel like an operations console that has been carefully typeset — controlled blue, white space, hairline structure — not like a startup marketing page.

## Anti-references

- Generic AI/SaaS landing pages: purple gradients, gradient text, glass cards, identical icon-card grids, uppercase tracked eyebrow above every section, giant metric blocks.
- A Microsoft/Entra ID clone: no Microsoft logo, no four-square mark, no Segoe imitation, no copied product chrome. The reference is the restraint and blue/white clarity, not the brand.
- Beige editorial-magazine minimalism, serif italics, and broadsheet grids — wrong register for infrastructure software.
- Developer-tool maximalism: neon-on-black, terminal cosplay, ASCII-noise decoration, monospace for every word.
- Marketing claims the library cannot prove: invented customer logos, benchmarks, or "enterprise-grade" filler.

## Design Principles

1. **Show the protocol, don't describe it.** Real request lines, real status codes, real `DomainFilter` trees, real NestJS code. Every claim has a concrete artifact next to it.
2. **Blue is structure, not decoration.** Color marks navigation, primary actions, and protocol state. It is not sprayed across gradients or used to make empty sections feel designed.
3. **Fewer surfaces, sharper edges.** Hairlines, tables, and code panels instead of card soup. If a border and a shadow both appear, one of them is wrong.
4. **Enterprise trust without corporate fog.** Exact RFC references and explicit limitations (alpha, no Groups, no sorting) build more trust than vague reassurance.
5. **Docs are the product.** The landing page and the documentation share one visual system, one type scale, and one voice. A developer should never feel they crossed into a different site.

## Accessibility & Inclusion

WCAG 2.2 AA. Body text at least 4.5:1, large text at least 3:1. Full keyboard operation, visible focus rings, semantic headings, skip link. All motion has a `prefers-reduced-motion` alternative and never gates content visibility. No information conveyed by color alone. Code samples remain readable at 200% zoom and on mobile via horizontal scroll.
