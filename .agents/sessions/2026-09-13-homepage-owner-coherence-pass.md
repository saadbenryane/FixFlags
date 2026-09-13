# Homepage owner coherence pass

Status: done. Owner: codex-root. Branch: main.

## Owner acceptance

- Pages preview fills its media area and every card action shares a bottom baseline.
- Remove visible controlled-example and not-live disclaimers.
- Reduce the gap before How FixFlags works by approximately 30%.
- Teach Flag. Fix. Verify. in three steps with a scroll-linked before/after reveal.
- Make automated tests and browser journeys one visually useful, business-aware section.
- Replace “learns what your website is for” with direct customer-value language.
- Use Flag Orange for marketing section labels.
- Combine Fix it your way and the AI handoff into one designed section.
- Remove the redundant verification sentence and Watch disclaimer.
- Remove the standalone Shopify strip; Shopify remains available in navigation and the footer.
- Review the complete desktop and mobile homepage for narrative, spacing, fit, and consistency.

## Implementation

- Consolidated eight narrative sections into five: board, workflow, business-aware coverage, fix/handoff, monitoring, then the final URL action.
- Rebuilt workflow proof as a sticky, scroll-linked comparison of the same `/contact` journey before and after correction. Reduced motion resolves immediately to the verified state.
- Reframed business understanding around critical visitor journeys and honest current browser/public checks. Removed unshipped deployment, real-visitor, and paid-traffic claims.
- Replaced duplicate Fix and AI sections with one Flag packet and three action routes backed by one evidence payload.
- Simplified monitoring language and made the primary Flag notification visually dominant.
- Updated shared BoardCard media cropping and grid rows so the Pages image fills its frame and its action aligns with sibling cards.

## Browser evidence

- 1280 × 900 and 375 × 812 render without horizontal overflow.
- Pages, Conversion, Security, Search, Performance, and Tracking action bottoms measure equally: 19px desktop and 17px mobile.
- Scroll reveal measured at 0%, 45.2%, 66.9%, and 100% while moving through the story.
- Mobile keeps the comparison pinned below the fixed header while the three steps scroll.
- Reduced-motion rendering resolves immediately to the verified state and suppresses the hero sweep.
- Artifacts: `output/playwright/homepage-after-desktop-full.png`, `output/playwright/homepage-after-mobile-full.png`, and `output/playwright/homepage-mobile-workflow-*.png` (local, not committed).

## Verification

- Focused homepage tests: 15 passed.
- `npm run ui:drift-guard`: passed.
- `npm run copy-drift-check`: passed.
- `npm run agent -- verify`: passed all 12 selected gates, including typecheck, lint, component and marketing tests, brand/UI drift, image/artwork, SEO, metadata, and copy checks.
- `npm run build`: passed; 123 static pages generated and homepage first-load bundle compiled at 211 kB.
