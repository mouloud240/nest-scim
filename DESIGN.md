# Design

## Theme

**Azure control plane at first light.** A white canvas, a deep navy protocol console, and one committed signal blue. Structure is drawn with hairlines and precise spacing rather than shadows and cards. The mood is cold, exact, and calm: an operations surface that has been typeset by someone who cares about tabular numbers.

The reference is Microsoft Entra ID's clarity — blue and white, dense but legible, confident without decoration — not its product chrome. The brand owns its own mark, type, and layout.

## Color

Strategy: **Committed** — blue carries the brand on hero, CTA, and protocol surfaces; white carries the reading surface. Cyan is a single accent for protocol state and diagram highlights, never body text.

All values are OKLCH; hex shown for implementation.

| Token              | OKLCH                    | Hex       | Use                                       |
| ------------------ | ------------------------ | --------- | ----------------------------------------- |
| `--bg`             | `oklch(1 0 0)`           | `#ffffff` | page canvas                               |
| `--surface`        | `oklch(0.975 0.01 240)`  | `#f1f8fd` | quiet sections, code chrome               |
| `--surface-2`      | `oklch(0.945 0.018 240)` | `#e3eff8` | hover, selected rows                      |
| `--ink`            | `oklch(0.22 0.04 252)`   | `#0c1b2d` | headings, body                            |
| `--ink-muted`      | `oklch(0.46 0.035 250)`  | `#495a6b` | secondary prose (7.1:1)                   |
| `--hairline`       | `oklch(0.89 0.02 245)`   | `#d0dce7` | borders, dividers                         |
| `--primary`        | `oklch(0.52 0.17 250)`   | `#006ac5` | actions, links, brand (5.44:1 with white) |
| `--primary-strong` | `oklch(0.42 0.15 252)`   | `#004c9b` | link text, hover, active                  |
| `--primary-soft`   | `oklch(0.95 0.03 245)`   | `#dff1ff` | inline code, selected nav                 |
| `--accent`         | `oklch(0.62 0.11 210)`   | `#0097ab` | diagram lines, large graphics only        |
| `--accent-bright`  | `oklch(0.80 0.12 205)`   | `#44d4e2` | dark-surface highlights (10.5:1 on navy)  |
| `--navy`           | `oklch(0.18 0.045 255)`  | `#041225` | console, CTA band, footer                 |
| `--navy-2`         | `oklch(0.24 0.05 253)`   | `#0c2036` | raised dark surface                       |

Dark mode inverts the canvas to `--navy`, raises surfaces to `--navy-2`, and moves the brand to a lighter blue (`oklch(0.72 0.13 245)`) so links keep 4.5:1. Cyan remains an accent only.

Rules:

- No gradient text, ever.
- No colored side-stripe borders. Use a full hairline, a background tint, or nothing.
- No 1px border plus a wide soft shadow on the same element.
- Cards, when unavoidable, top out at 12px radius; buttons use 6px.
- Focus ring: 2px `--primary` offset 2px, visible on both themes.

## Typography

- **Display + body:** Schibsted Grotesk Variable. A Norwegian grotesque with tight, confident caps and a humanist lower case; it reads as infrastructure rather than startup. Weights 400, 500, 600, 700, 800.
- **Code + protocol metadata:** JetBrains Mono Variable. Used for code, request lines, status codes, RFC references, and small technical labels — never for body prose.
- **Scale:** fluid `clamp()` with a ≥1.25 step. Hero `clamp(2.75rem, 6vw, 5.25rem)`, section `clamp(1.9rem, 3.2vw, 2.75rem)`, body 1.0625rem/1.65.
- **Letter-spacing:** display `-0.03em` (floor `-0.04em`); body `0`; mono labels `0.01em`.
- **Measure:** 68ch for prose, 74ch maximum. Headings use `text-wrap: balance`; long prose uses `text-wrap: pretty`.
- **Numbers:** tabular in tables and protocol panels (`font-variant-numeric: tabular-nums`).

## Layout

- Max content width 1180px; prose column 760px; docs content inherits VitePress's 688px reading width.
- 8px spacing base; section rhythm alternates 96px and 128px on desktop, 64/80 on mobile.
- Hero: asymmetric 7/5 split; console panel aligned to the top of the headline, not centered.
- Feature list: hairline-separated rows with a left icon, title, description, and right-aligned RFC reference. Not a card grid.
- Code and prose pair side-by-side above 960px; stack with the code second on mobile.
- No horizontal overflow at 320px; console and tables scroll inside their own containers.

## Components

- **Install command:** a mono pill with a copy button. White surface, hairline border, 6px radius, primary copy icon; success state is text + check, not color alone.
- **Protocol console:** navy panel, 12px radius, 1px blue-tinted border, mono type, a status bar with a live dot, a request line, a JSON response, and a compiled `DomainFilter` tree. No glow, no glass.
- **Capability row:** 20px line icon in primary, 600-weight title, muted description, mono RFC reference at the right edge.
- **Endpoint table:** full-width table with mono method tokens (`GET`, `POST`), hairline row dividers, no zebra striping.
- **Buttons:** primary = solid blue with white text, 6px radius; secondary = hairline border on white; both 44px minimum height.
- **Docs sidebar:** one navigation tree across guides, API reference, recipes, and project status. Collapsible parent groups keep the current branch open; muted uppercase top-level labels distinguish the major areas, and the active page uses a blue-tinted row rather than a side stripe.
- **Docs callouts:** VitePress custom containers restyled to blue-tinted backgrounds with a 1px full border and a leading icon; no side stripe.

## Motion

- One orchestrated first load: hero copy rises 8px and fades over 520ms with a 60ms stagger; console enters 12px later. Easing `cubic-bezier(0.22, 1, 0.36, 1)`.
- The console status dot pulses once every 4s, slowly; the filter tree connector line draws once.
- Hover transitions are 140ms, color/border only. No transforms on text.
- `prefers-reduced-motion: reduce` removes all entrance and looping animation; content is fully visible without motion. No scroll-triggered reveals.

## Accessibility

- Contrast verified against WCAG 2.2 AA: ink 17.3:1, muted 7.1:1, primary 5.44:1 with white, code ink 15.35:1 on navy.
- Every icon-only control has an accessible name; the copy button announces success via `aria-live`.
- The console is a `<figure>` with a caption; decorative SVG is `aria-hidden`.
- Focus order follows DOM order; skip link is the first focusable element.
- Docs search is keyboard operable; mobile nav traps focus correctly (VitePress default).
