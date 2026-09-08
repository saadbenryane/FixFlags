# Homepage: Your website, looked after

Implemented the owner-supplied September 8 homepage brief on `/`. Scope: homepage component and CSS module, centralized `CARE_HOME` copy, homepage metadata, restrained shared marketing navigation/account action, additive label/placeholder overrides on the existing AuditInput. Preserved the pre-existing dirty working tree and separate board prototype. Owner's explicit homepage request supersedes the older overlapping homepage entry on the Shopify task.

The narrative includes the hero board, status cards, customization, progressive context, Flag and illustrated journey, Find/Understand/Fix/Verify, checks, connections, agent handoff, quiet monitoring, phone board, Shopify, pricing and final URL form. Cards open accessible dialogs; adding a card updates the preview; fix instructions expand and can be copied. Verification explains how a real URL check differs from this illustrative example. Navigation routes are existing paths.

Example values are explicitly illustrative. Connections and monitoring show preview/roadmap labels; proposed free monitoring/Pro entitlements are not sold as shipped. Current pricing is linked. The Flag journey is an illustration, not fabricated screenshot/replay evidence. The URL form retains actual `/api/checks` submission and existing auth, claim and handoff handling.

## Verification

- `npm run agent -- verify --dry-run`: selects full-repository validation because unrelated shared configuration was already changed. Scoped equivalent used for this homepage task rather than attributing 376 pre-existing changed files to this work.
- Focused ESLint: passed on the new component/copy, homepage route, AuditInput, marketing account action and navigation.
- Focused Vitest: 3 files, 41 tests passed (navigation, existing marketing components and homepage copy guardrails). Updated navigation expectations for the requested menu.
- Brand hex and copy drift guards: passed.
- TypeScript: two errors in pre-existing `lib/shopify/__tests__/session.test.ts` lines 34/41, assigning readonly NODE_ENV. No homepage type errors.
- UI drift guard: existing font-display findings in `app/new/page.tsx` and `app/shopify/ShopifyWorkspace.tsx`.
- Marketing artwork guard: old LandingHowItWorksSection lacks expected historical workflow image. New homepage no longer renders that component. Left its other-owner implementation untouched.
- Browser: real rendered local `/` at 1440x1000 and 375x812; board detail, Add card insertion, Escape dismissal, Fix and Verify examples exercised. Invalid URL submission reaches existing API and returns 400; no paid/live scan created.
- Axe WCAG A/AA + 2.1 AA: zero violations on homepage main at 375px; document width equals viewport, no overflow.
- Screenshots: `output/playwright/care-home-desktop.png`, `care-home-desktop-full.png`, `care-home-mobile.png`, `care-home-mobile-full.png`, `care-home-flag.png`.

No deployment performed; no claim that planned Site capabilities shipped. Preview available on existing local dev server at http://localhost:3000.

Final follow-up: fixed dialog focus restoration and verified in a fresh browser session that Escape returns focus to the Add card opener. Desktop Axe also reports zero violations; 320px layout has document width 320px. Final targeted lint passed. Final TypeScript result remains only the two existing Shopify test errors noted above.

## Owner palette correction

Replaced dark orange brand fills with the supplied bright orange (FF5A00) in light/dark canonical tokens and the non-CSS brand palette. Hover is FF6E1F; button labels use ink for approximately 6.3:1 contrast. Status tokens are untouched. Updated DESIGN.md and the design skill to prevent restoring dark orange for white-label contrast. Scoped validation after agent verify dry-run: brand hex guard, brand-spec ESLint and diff whitespace checks passed. Real browser confirmed button background rgb(255,90,0), ink text, hover rgb(255,110,31); screenshot output/playwright/care-home-bright-orange.png. No deployment.

Owner follow-up: explicitly requested white text on the bright orange buttons. Updated brand-foreground in both CSS themes and the non-CSS palettes to white; supersedes the ink-label choice above. Bright orange fill and hover are unchanged.
