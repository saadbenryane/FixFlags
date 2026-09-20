# Homepage conversion refactor

Status: done. Owner: codex-root. Branch: main.

## Outcome

- Replaced the contact-confirmation story with one purchase-path Flag across the Site board, Flag. Fix. Verify., handoff packet, and monitoring notifications.
- Added deterministic empty-cart and verified-cart evidence captures.
- Replaced the journey diagram and technical taxonomy with a keyboard-accessible Website · Store · Web app example selector.
- Reframed the handoff around the problem, proof, and next step; removed “one Flag,” “fix it yourself,” and “ready for whoever fixes it.”
- Removed the hero scan/glow and orange halo effects.
- Added a focused integrations section and `/integrations` page. Shopify is available now; Analytics, Search Console, and Deployments are plainly marked as planned and have no connect controls.
- Split the homepage into hero, primitives, and narrative section components while preserving AuditInput, BoardCard, dialogs, focus restoration, clipboard fallback, and the marketing shell.

## Browser evidence

- Homepage reviewed at 1280×900, 768×900, and 375×812 with no horizontal overflow.
- `/integrations` reviewed at 1280×900 and 375×812.
- Audience selector changed Website to Store in a real browser.
- Reduced-motion result: workflow reveal `100%`, active animations `0`.
- Screenshots: `output/playwright/homepage-conversion-refactor-{1280,768,375}.png` and `output/playwright/integrations-{1280,375}.png`.

## Verification

- Focused homepage, integrations, metadata, and SEO tests: 21 passed.
- `npm run agent -- verify`: passed all 13 selected gates.
- `NEXT_DIST_DIR=.next-homepage-conversion npm run build`: passed; 124 static pages generated and `/integrations` prerendered.
- The isolated build directory avoided racing the owner's existing FixFlags dev server.
