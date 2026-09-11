# Vision implementation · 2026-09-09

Implement the accepted Site product: lexicon, Flag projector, Watch honesty, Site chrome, Flag. Fix. Verify. loop, URL-first legal, Shopify Can't buy as a Site Flag, owner report redirect.

## Decision

Work stayed on `main`. `board-card-chrome` was absorbed because it is the same grok owner. Homepage CSS/media for `homepage-end-user-polish` was left alone; CARE_HOME catalog names and card-face status strings were coordinated so Pages and 0 Flags/3 Flags stay honest.

Pulse vs full stays typed. Hourly pulse is not scheduled. Public copy stays weekly / every day. `STRIPE_PAID_OPEN` stays false.

## Shipped in this cut

- Analyze CTA, `CORE_LOOP_LABEL = Flag. Fix. Verify.`, brand tagline, Sites in account chrome.
- `isCustomerFlag` projector. Site Flag lists and counts are act-on-this. SEO/optional meta can be Recommendations in card depth. Coverage incomplete is never healthy.
- Free Watch uses `canAccessProductWatch`. Watch mail uses Flag voice. `plannedWatchJobs()` returns `{ pulse: null, full: interval }`.
- Pages card, card face Flag count (not Checks passed / Needs attention / Looking good), Home · Flags · Settings / More, Journey chrome.
- Send a Flag to your AI leads Flag actions. Prompt includes URL and Journey. Verify states: Verified / Still open / Inconclusive / Couldn't verify.
- URL-first legal/privacy. Help/docs loop. Shopify RED paths upsert a Flag on a matching Site. Support extracts Site/Flag from `/sites/`. Signed-in owners with a Site redirect from `/report/[id]` to `/sites/{id}`.

## Later (not claimed)

Hourly pulse, FixFlags Agent FAB, MCP as a customer surface, extra connections, deleting the report runtime.

## Verification

- `npx tsc --noEmit` green.
- Focused vitest: 2621 passed in affected `app/`, `lib/audit/`, `lib/billing/`, `components/`, `lib/marketing/`, `lib/sites/`, `lib/auth/`, `lib/help/`, `lib/live-support/`, `lib/integrity/` groups.
- `lib/integrity/__tests__/run-path-probe.test.ts` could not launch Chromium in this sandbox; not a product assertion from this cut.
- Browser 375/1280 not re-run here. Site chrome and Flag actions are covered by component tests.

No deploy.
