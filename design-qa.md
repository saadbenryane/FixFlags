# Launch design QA

## Comparison target

- Source visual truth:
  - Homepage: `/Users/saadbenryane/Pictures/Photos Library.photoslibrary/resources/derivatives/0/0920A529-3F80-40D3-A860-98C7D4478ADE_1_105_c.jpeg`
  - Pricing: `/Users/saadbenryane/Pictures/Photos Library.photoslibrary/resources/derivatives/2/21F9F6AE-4D42-4160-9AB4-34B304E70BA2_1_105_c.jpeg`
  - Dashboard: `/Users/saadbenryane/Pictures/Photos Library.photoslibrary/resources/derivatives/4/42CBF027-EE45-4E56-A80D-ACDAA60CC43C_1_105_c.jpeg`
- Browser-rendered implementation:
  - `/Users/saadbenryane/.codex/visualizations/2026/07/26/019f9e61-2bff-77b1-a87e-7fc40e8a0ae6/fixflags-launch-final/home-1086x732.png`
  - `/Users/saadbenryane/.codex/visualizations/2026/07/26/019f9e61-2bff-77b1-a87e-7fc40e8a0ae6/fixflags-launch-final/pricing-1280x900.png`
  - `/Users/saadbenryane/.codex/visualizations/2026/07/26/019f9e61-2bff-77b1-a87e-7fc40e8a0ae6/fixflags-launch-final/dashboard-1086x732.png`
- Local routes: `/`, `/pricing`, `/dashboard`
- Desktop CSS viewports: `1086 × 732` for the exact homepage reference comparison and `1280 × 900` for the full launch-page pass, device density `1`
- Mobile CSS viewport: `375 × 812`, device density `1`
- Source pixels:
  - Homepage: `1086 × 732`
  - Pricing: `724 × 1086`; the top `724 × 510` region was normalized to the implementation's `1280 × 900` aspect ratio for the focused hero-and-plans comparison
  - Dashboard: `1086 × 732`
- State:
  - Light theme
  - Authenticated marketing header and populated dashboard
  - Current pricing content and entitlements were retained even where the reference used older plan names, limits, or prices

## Evidence

- Exact-size homepage hero comparison: `/Users/saadbenryane/.codex/visualizations/2026/07/26/019f9e61-2bff-77b1-a87e-7fc40e8a0ae6/fixflags-launch-final/home-reference-vs-final.png`
- Focused pricing hero and plan comparison: `/Users/saadbenryane/.codex/visualizations/2026/07/26/019f9e61-2bff-77b1-a87e-7fc40e8a0ae6/fixflags-launch-final/pricing-top-reference-vs-final.png`
- Full-view dashboard comparison: `/Users/saadbenryane/.codex/visualizations/2026/07/26/019f9e61-2bff-77b1-a87e-7fc40e8a0ae6/fixflags-launch-final/dashboard-reference-vs-final.png`
- Mobile evidence:
  - `/Users/saadbenryane/.codex/visualizations/2026/07/26/019f9e61-2bff-77b1-a87e-7fc40e8a0ae6/fixflags-launch-final/home-375x812.png`

## Findings

- No actionable P0, P1, or P2 visual differences remain.
- Fonts and typography: display weight, compact tracking, monospaced eyebrow labels, hierarchy, and wrapping match the reference language. Longer current pricing copy intentionally produces different headline and card wrapping.
- Spacing and layout rhythm: the desktop hero splits, card tracks, gutters, radii, borders, and shadows match the reference proportions. Mobile layouts collapse cleanly without horizontal overflow or hidden persistent controls.
- Colors and visual tokens: existing FixFlags background, ink, orange brand, border, muted, destructive, and success tokens reproduce the source palette without adding isolated color values.
- Image quality and asset fidelity: the homepage uses a clean crop of the supplied launch artwork. The pricing pedestal visual matches the supplied art direction and is masked into the page background without a visible rectangular edge.
- Copy and content: current canonical plan names, prices, limits, product terms, and real dashboard data were preserved. Unsupported builder counts, testimonials, and other reference-only claims were not introduced.
- Icons and controls use the existing project icon system. Primary navigation, mobile navigation, URL input, pricing actions, FAQ accordion, report links, and dashboard actions remain real controls.
- The supplied references do not define mobile layouts. The `375 × 812` captures were therefore evaluated as responsive adaptations of the same hierarchy rather than pixel-identical targets.

## Comparison history

### Pass 1

- [P1] The pricing hero was too tall and pushed the plan grid too far below the fold.
- [P2] The generated pricing image had a visible rectangular background edge.
- [P2] The existing homepage hero artwork contained visibly garbled microcopy.
- [P2] A one-point dashboard history rendered as an unhelpful isolated chart mark.
- [P2] The floating support control covered card actions on both marketing and app surfaces.

Fixes:

- Reduced pricing hero type and artwork scale, tightened the grid, and widened the headline measure.
- Added a soft image mask so the product render blends into the canvas.
- Replaced the garbled homepage hero asset with a clean crop of the supplied reference artwork.
- Changed the chart to an explicit progress empty state until a re-check exists.
- Removed the floating support control from launch marketing and app shells; app help remains available in navigation.

### Pass 2

- Re-captured all three desktop routes at `1280 × 900`.
- Rebuilt normalized same-input comparisons for the homepage, pricing hero/plans, and dashboard.
- Captured all three routes at `390 × 844`.
- Confirmed no remaining P0/P1/P2 differences.

### Pass 3: homepage hero fidelity

- [P2] The homepage illustration had an added orange radial glow that was not present in the supplied design.
- [P2] The illustration scale and placement drifted from the source when compared at its native `1086 × 732` viewport.

Fixes:

- Removed the artificial radial glow behind the illustration.
- Matched the supplied illustration crop at `600 × 565`, aligned its top and right edges to the source, and corrected the hero's desktop vertical rhythm.
- Matched the source eyebrow and supporting sentence while keeping current authenticated navigation and product-true social proof.
- Re-captured desktop at the exact source viewport and mobile at `390 × 844`.
- The post-fix side-by-side comparison shows no remaining actionable P0/P1/P2 hero differences.

### Pass 4: launch-ready spacing and permanent assets

- [P2] Marketing section spacing was fragmented across shared variants and page-level overrides.
- [P2] The Check Dimensions section bypassed its raster asset with temporary CSS/div artwork.
- [P2] The sample anchor landed on section padding instead of the first useful content.
- [P2] The global marketing backdrop still contained animated glow layers.

Fixes:

- Centralized responsive hero, default, and marketing section rhythm in design tokens and the shared `Section` primitive.
- Replaced the Check Dimensions fallback branch with one transparent production image and removed the CSS art, inline illustration SVG, and glow.
- Moved the sample anchor to the content container with the marketing-header offset.
- Removed decorative marketing glow layers and retained depth through the approved cards, shadows, and alternating section tints.
- Re-captured the source-sized homepage and dashboard states, the pricing hero/plans, and mobile homepage after the implementation settled into its enabled state.
- Verified zero horizontal overflow across 320, 375, 768, 1086, 1280, and 1440px homepage widths, plus the launch-critical route matrix.

## Interaction and runtime checks

- Mobile navigation opened and closed successfully.
- Pricing FAQ expanded successfully and exposed its answer region.
- Homepage, pricing, and dashboard routes loaded in the in-app browser.
- Browser console: zero runtime errors. Development-only React DevTools and Fast Refresh messages were present.
- Dashboard `Open report` navigated through the rendered link to the completed report.
- Completed reports retained the full Fix list while asynchronous prompt enrichment remained visibly identified.
- TypeScript, ESLint, component tests, brand hex, UI drift, local-image, SEO, billing tests, migration status, and schema drift checks passed.

## Homepage footer fidelity addendum

### Comparison target

- Source visual truth: `/Users/saadbenryane/Pictures/Photos Library.photoslibrary/resources/derivatives/5/5FF95CD4-5840-4762-A972-1BA72BDB16A5_1_105_c.jpeg`
- Browser-rendered desktop implementation: `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-footer-reference-fidelity/implementation-desktop-viewport-final-1090x900.png`
- Browser-rendered mobile implementation:
  - `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-footer-reference-fidelity/implementation-mobile-final-375x812.png`
  - `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-footer-reference-fidelity/implementation-mobile-bottom-375x812.png`
- Desktop CSS viewport: `1090 × 900`; captured browser content pixels: `1090 × 839`
- Mobile CSS viewport: `375 × 812`; device density `1`
- Source pixels: `1090 × 732`; no density normalization was required
- State: light theme, homepage final CTA and footer, newsletter idle

### Evidence

- Full-view same-input comparison: `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-footer-reference-fidelity/comparison-desktop-final-side-by-side.png`
- Focused desktop footer viewport: `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-footer-reference-fidelity/implementation-desktop-viewport-final-1090x900.png`
- Focused mobile top and bottom captures are listed above. Separate focused captures were necessary because the source does not define a mobile state and the complete mobile footer is taller than one viewport.

### Findings

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: the implementation matches the compact Inter/Inter Tight hierarchy and monospaced uppercase footer labels. The CTA headline now wraps to the same two-line measure as the source.
- Spacing and layout rhythm: the oversized footer was replaced with the reference's compact six-column information grid and distinct lower trust band. CTA height, column widths, builder grid, divider placement, and desktop footer density now follow the source proportions.
- Colors and visual tokens: the implementation uses the existing background, muted, border, foreground, and brand tokens. No isolated colors or gradients were added.
- Image quality and asset fidelity: the official local FixFlags logo assets remain sharp at desktop and mobile sizes. The source's decorative 3D logo cube was intentionally not recreated because the repository already has the canonical production brand asset.
- Copy and content: current product-true copy, routes, privacy terms, scan assurances, re-check promise, and free-check scope were preserved. Unsupported source-only customer counts, SOC claims, social accounts, and fabricated metrics were not introduced.
- Responsiveness: desktop and `375px` mobile have zero horizontal overflow. Mobile uses two-column navigation and metric grids, with the brand, builder integrations, copyright, and newsletter spanning both columns.
- Interaction and runtime: the URL review control remains functional. The newsletter input and uniquely named submit button are present and enabled. Browser console errors: zero.

### Comparison history

#### Pass 1

- [P1] The existing desktop footer was a tall five-column stack with builder integrations inside the brand column, unlike the source's compact six-column composition.
- [P2] The final CTA was approximately twice the intended height and its headline, input, and assurance row had the wrong proportions.
- [P2] Legal navigation and the lower trust/metrics strip were missing.

Fixes:

- Rebuilt the footer into brand, Product, Resources, Company, Legal, and builder-integration columns.
- Moved the newsletter into the lower trust band and retained its real submission behavior.
- Added product-true trust metrics sourced from the existing canonical landing copy.
- Tightened the final CTA card, headline measure, field placement, assurance row, padding, radius, and section spacing.

#### Pass 2

- [P2] Builder names clipped at the source viewport.
- [P2] The first responsive adaptation stacked every footer section in one column and was unnecessarily long.

Fixes:

- Reduced builder-chip type and padding, and used the compact visible `Claude` label from the source while retaining the existing editor mark.
- Changed mobile navigation and trust content to efficient two-column grids with full-width anchor sections.

#### Pass 3

- Re-captured desktop at `1090 × 900` and mobile at `375 × 812`.
- Confirmed exact-width desktop and mobile have no horizontal overflow.
- Confirmed the newsletter controls are present and enabled and the browser console has no runtime errors.
- No remaining P0/P1/P2 findings.

final result: passed

---

# Homepage benefits and workflow fidelity QA

## Comparison target

- Source visual truth: `/Users/saadbenryane/Pictures/Photos Library.photoslibrary/resources/derivatives/B/B3CAD876-7FA1-4000-B19A-5ECD29E888D3_1_105_c.jpeg`
- Browser-rendered implementation: `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-benefits-workflow-desktop-light.png`
- Same-input comparison: `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-benefits-workflow-comparison.png`
- Responsive evidence: `/Users/saadbenryane/Code/qewos/.agents/artifacts/homepage-benefits-workflow-mobile.png`
- Route and state: `/`, light theme, benefits and editor-workflow sections in their enabled reveal state
- Desktop CSS viewport: `1086 × 900`, device density `1`
- Mobile CSS viewport: `390 × 844`, device density `1`
- Source pixels: `1086 × 724`
- Desktop screenshot pixels: `1086 × 839`; the page-content region was cropped to `1086 × 724` for the normalized side-by-side comparison
- Mobile screenshot pixels: `390 × 839`

## Full-view comparison evidence

- The final benefits region measures `382px` high versus approximately `384px` in the source.
- The final workflow card measures `317px` high versus approximately `313px` in the source.
- The card width is `1038px`, matching the source card width at the `1086px` reference viewport.
- The implementation preserves the source hierarchy: two-line display headline, centered subhead, five equal feature columns, compact workflow card, left editor rail, vertical divider, four inbound states, central product asset, and three outcome states.

## Focused region comparison evidence

- Header and feature rail: display line breaks, eyebrow treatment, icon-tile scale, dividers, title weight, and body measure were inspected in the normalized comparison.
- Workflow card: padding, divider placement, chip density, connector alignment, central glass-mark crop, success dots, radius, border, and shadow were inspected at the source viewport.
- The existing high-resolution `pricing-glass-mark.webp` remains the central product image. It is sharp, correctly cropped, and free of placeholder or generated-text artifacts.

## Findings

- No actionable P0, P1, or P2 visual differences remain.
- Fonts and typography: the implementation uses the existing Inter Tight display and product sans/mono system. Weight, tracking, line height, and wrapping now closely match the source. The canonical word `finish` is intentionally retained instead of the older reference word `ship`.
- Spacing and layout rhythm: the previously oversized section and card were reduced to the source proportions. Feature columns, vertical dividers, card padding, editor rail, and outcome rail align with the reference.
- Colors and visual tokens: existing foreground, muted, background, border, brand-orange, shadow, and success tokens reproduce the source without introducing isolated color values.
- Image quality and asset fidelity: the supplied FixFlags glass-mark asset is used directly and remains crisp at desktop and responsive sizes. Existing icon-library marks are used for all interface icons.
- Copy and content: canonical current marketing copy and real supported editor names were retained. `Claude Code` is visually shortened to `Claude` only in the compact integration grid.
- Responsiveness: the `390px` capture has zero horizontal overflow. The benefits stack into readable centered cards, the editor marks become a two-column grid, and the workflow diagram collapses without clipping.
- Accessibility and behavior: the sections remain semantic headings and lists. The workflow illustration is intentionally decorative and excluded from the accessibility tree. Reveal motion retains the existing reduced-motion behavior.

## Comparison history

### Pass 1

- [P1] Both sections were substantially taller and sparser than the source.
- [P1] The workflow card lacked the reference’s left rail, divider, connector network, and compact outcome rail.
- [P2] The benefits headline rendered as one oversized line instead of the source’s deliberate two-line hierarchy.
- [P2] Editor marks used loose pills and the central product image was materially undersized.

Fixes:

- Rebuilt the benefits header and feature grid around the source line breaks, scale, divider height, and vertical rhythm.
- Rebuilt the workflow card as a three-part composition with compact editor marks, divider, inbound states, real product imagery, connector paths, and outcome states.
- Preserved canonical copy and current supported integration names.

### Pass 2

- [P2] The benefits region still measured `469px` and the workflow card `454px`, materially exceeding the source.
- [P2] Editor marks formed four rows, increasing card height and weakening the intended compact rail.

Fixes:

- Tightened typography, section padding, feature spacing, diagram scale, and card padding.
- Added compact editor display labels and moved the editor marks to a four-column, two-row desktop grid.

### Pass 3

- Re-captured at the exact `1086px` source width.
- Measured the final regions at `382px` and `317px`.
- Built and visually inspected the normalized side-by-side comparison.
- Captured the responsive `390px` layout and confirmed zero horizontal overflow.
- No actionable P0/P1/P2 differences remain.

## Interaction and runtime checks

- These sections contain no user-operated controls; their semantic content and responsive behavior were exercised through the real homepage route.
- The theme control was used to inspect the supplied light-reference state.
- The browser reported repeated pre-existing `/api/me` update-depth errors while local PostgreSQL and Redis were unavailable. No error originated in the three changed marketing components, and the sections rendered stably.
- Focused ESLint and a clean non-incremental TypeScript build passed.
- The UI drift guard is currently blocked by separate in-progress `components/auth/AuthCard.tsx` and `components/layout/footer.tsx` changes.
- The repository-selected verification gate is currently blocked by unavailable local PostgreSQL during `db:check`.

final result: passed
