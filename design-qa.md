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

final result: passed
