---
status: canonical
authority: interface
reviewed_at: 2026-10-24
supersedes: [lib/design/brand-rules.md]
---

# Design system

This document owns reusable visual and interaction conventions. Preserve the current appearance of each surface when refactoring shared styles.

Product objects and navigation belong to [product architecture](docs/product-architecture.md), Site behavior and states to [the interface contract](docs/workspace-interface.md), and acceptance requirements to [the PRD](docs/product-prd.md). Personality lives in [SOUL.md](SOUL.md). Vocabulary lives in [voice and copy](docs/voice-and-copy.md); exact rendered strings live in `lib/marketing/copy/`. Current report routes retain their [compatibility contract](knowledge/report-contract.md).

## Executable sources

| Source | Responsibility |
| --- | --- |
| `lib/design/tokens.css` | CSS colors, type scale, radii, shadows, spacing, motion timing and stacking layers |
| `tailwind.config.ts` | Utility mappings to tokens, font families and animation definitions |
| `lib/design/brand-spec.ts` | Brand values for OG images, email, badges and manifest consumers that cannot use CSS |
| `components/ui/` | Shared controls, typography, surfaces and interaction primitives |
| `components/sites/BoardCard.tsx` and its CSS module | Flat Site cards and rows, also reused by the homepage sample |

Use existing semantic tokens before adding values. Add a shared token for a repeated role, not every local layout measurement. Non-CSS brand values must agree with the approved identity; contextual status and grade palettes may differ by consumer. Do not maintain palette tables in Markdown.

## Identity and typography

- Keep the official folded-F mark. `public/brand/logo-mark.svg` is the cleaned trace of the owner silhouette, with flat orange fill and no outline. `components/brand/Logo.tsx` combines it with the Inter Tight wordmark, with Fix heavier than Flags. Preserve the silhouette and proportions.
- Original owner sources and asset provenance live in [the reference index](docs/brand/reference/README.md). Use `npm run brand:icons` to derive runtime logo sizes.
- Inter is the product UI and body face. Inter Tight is used for marketing display, prices, wordmarks and editorial Help/Docs headings. JetBrains Mono is used for code, IDs and numeric evidence, not marketing display.
- Preserve the existing responsive heading sizes and weights. Use `text-balance` for headings, `text-pretty` for body, and `tabular-nums` for comparable numbers.
- Marketing section labels use sentence case. The current homepage hero eyebrow and prompt-card metadata retain their approved uppercase treatment. Functional metadata may use mono uppercase labels.

## Color and controls

- Bright Flag Orange is the shared brand signal in both themes. Orange buttons use white labels at every existing size. Do not enlarge text or darken the approved fill to change this treatment.
- Product primary controls retain their current ink light-theme and orange dark-theme treatments. Use the shared Button variants instead of recreating them.
- Brand and evidence state are separate roles. Pair status colors with text; retain warning for billing/quota caution and grades for report scores. Evidence rules belong to [the evidence contract](knowledge/evidence-rules.md).
- Dark mode uses its authored tokens, not a blanket inversion. Third-party logo plates that need white retain a fixed white semantic surface in both themes.
- Controls and inputs use `--radius-control` and `--radius-input`. Focus uses `--focus-ring` through `--ring`; error styling uses `--destructive`.

## Surface families

| Surface | Current treatment |
| --- | --- |
| Marketing | Whitespace, display hierarchy and section tone; existing special illustrations and connection panels retain their local composition |
| Site board and homepage sample | Neutral cards with a soft resting shadow, a slightly deeper hover shadow, board-specific radii, and status dots and counts for flagged categories |
| Existing report and glass surfaces | Shared Card/Surface variants, glass tokens and nested radii; these do not define the Site board recipe |
| Controls and functional data | Borders where needed for inputs, tables, dialogs and progress/detail panels |

Shared identity does not require identical card sizes, backgrounds or typography across these families. Keep board card and panel radii separate from the glass-card radius. Inner glass radii use the existing outer-radius-minus-gap tokens.

Never use line separators. Group content with whitespace, typography, and surface tone. Board cards use a soft shadow instead of an outline. Input boundaries and focus rings define their controls. Do not use standalone horizontal or vertical rules to separate content. Interaction placement and category anatomy belong to the Site interface contract.

Give each piece of overview information one primary location. Site identity belongs in the sidebar. Availability and its observation time appear together in the uptime header; scan progress stays with the Site identity. Overall counts appear once in the summary, without a repeated Findings heading or attention sentence. The overview leads with the website capture and one summary, then aligned monitoring panels, a compact grid of categories with Flags, and quiet clear cards. Flags are actions inside their category. Detected tools sit with the summary, showing the complete recorded tool list. Monitoring is a compact header control beside refresh, with schedule details disclosed on demand. The website preview shows the complete capture; URL, capture time, viewport, and previous-capture provenance remain available when it is enlarged. The homepage sample and real Site use the same shared components and layout.

Pages depth leads with previews for the recorded pages. Each thumbnail must use that page's own capture from its source audit. Missing or failed captures retain an explicit empty state, never a substitute screenshot. Pages is a persistent workspace destination. Category and Flag modals contain evidence and relevant fix actions, without an Analyze your website promotion.

## Layout and motion

Marketing overview pages share `MarketingPageHeader`: centered Inter Tight display title, a constrained description, sentence-case neutral eyebrow with a bright orange dot, and centered actions. The header owns its top and bottom spacing; enclosing Sections use `overview` spacing. Avoid repeating the page introduction above its first content section. Homepage heroes, articles, docs, legal reading pages, tools, and connection flows retain their own compositions.

- Keep responsive containers and spacing in the shared Container and Section primitives where they apply. Their variants intentionally use different widths and rhythms.
- Reflow real-length names, answers and status controls without overlap. Preserve mobile access to the same content and actions; do not impose fixed card heights to hide wrapping.
- On phones, keep Site identity and navigation labels visible. Let toolbar controls wrap, keep disclosures inside the available content area, and respect device safe areas in full-height details and fixed navigation.
- Marketing uses its existing canvas and section tints. The shared shell's minimal grid is an app/admin treatment, not a marketing hero background.
- Motion communicates state, expansion or feedback. Preserve current homepage connection-card motion and its reduced-motion/mobile behavior; do not reintroduce unused ambient orb animations.
- App, report, dashboard and admin surfaces idle without decorative animation. Loading indicators may animate while work is running.
- Use specific transition properties, `--motion-fast` and `--ease-out` where applicable. Never use `transition: all`.
- Captured evidence uses opacity-only entry effects that do not move layout. Respect `prefers-reduced-motion` for transitions, animation and scrolling.

Prompt actions always offer a readable preview. Copying, inspecting, and independent verification have separate effects. A changed prompt must be reviewed before copying. Category depth supports explicit Flag selection. Unavailable integrations live in a collapsed catalog; saved connections retain review and cleanup actions.

## Interaction and validation

- Preserve rest, hover, keyboard focus, active, disabled and loading states. Keep Button loading/slot behavior and existing dialog focus trapping, Escape dismissal and focus restoration.
- Returning from a Flag to its page list restores the prior scroll position and result focus. Switching views from a disclosure keeps keyboard focus in the destination view.
- Use 44px hit targets for shared controls. Keep icon actions accessible by name and preserve touch access to actions otherwise revealed on hover.
- Preserve control size during opening and pressed feedback. Interactive overlays may fade or translate without shrinking their hit targets.
- JavaScript controls use the shared readiness primitives and remain disabled and busy until their handlers are ready. Native server form controls without client callbacks and real links retain their browser behavior.
- Preserve semantic heading order, form labels, status announcements and Radix screen-reader behavior. Use the existing EmptyState and RouteErrorPage primitives.
- Use lucide-react for interface icons and approved assets for brand and third-party marks. Decorative media must not become fabricated customer evidence.
- Run the focused component checks and existing brand/UI guards for changed surfaces. Follow [AGENTS.md](AGENTS.md) for validation scope; browser and E2E tests require an explicit request.
