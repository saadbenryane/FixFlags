# Game On Site completeness

Date: 2026-09-08
Owner: cursor-seo-loop
Branch: main

## Outcome

The Site loop is designed, not wrapped. Coverage-honest health, Flag verify with READY_TO_VERIFY, watch pause/quota on the board, one public story, and production Next lint blockers that stopped Railway `next build` are fixed.

## Production

Railway `FixFlags` / `FixFlags Worker` failed `next build` on four ESLint errors:

- unused `initialAuditUrl` in dashboard
- Shopify walk `<video>` captions
- unescaped apostrophe in OG template
- unused `_reportCompleteness`

Those are fixed. `npx tsc --noEmit --incremental false` and `npx next lint` pass. `web` (Aug 19) was left alone.

Live `/api/health` must equal this commit SHA after deploy. Then `npm run growth:verify-live` and one stranger URL → `/sites/...`.

## Loop

- Site card is not healthy from zero Flags when starter areas are unknown. `PARTIAL` is not an AuditStatus.
- Verify records `READY_TO_VERIFY`, scopes capture to the Flag page (`SINGLE`), and copy never resolves.
- Watch: Free weekly stays allowed. Pause keeps the interval and clears `nextRunAt`. Board shows watching / paused / delayed / quota. "You're covered" only after a schedule write.
- Status and keep-email use provisional `p_*` Site ids. `/products/[id]` stays a redirect. ProductWorkspace is parked.

## Public story

`marketing-care-alignment` finished homepage/FAQ chrome. This pass aligned Help getting-started, Docs, llms notes, auth, keep-email, nurture, billing pause, usage meter, root metadata, roast (noindex, Site CTA), and leftover FAQ changelog / plans upsell language. Shopify remains a connection.

## Proof

`npx vitest run` slices: `app/api`, `app/`, `lib/audit/`, `components/`, `lib/marketing/` all passed. Focused locks: coverage-bounded health, verify attempt lifecycle, provisional siteId, keep-email Site URL, watch pause/quota copy. `copy-drift-check` and `help:catalog-guard` passed. `ui:drift-guard` still fails on pre-existing SiteBoard / `/new` / ShopifyWorkspace `font-display` and `rounded-xl` (not introduced as the product loop). Full-repo `npm run lint` still fails on `prototypes/fixflags-board/dist`; Railway uses `next lint`.

Owned fixture: homepage contact-form evidence (`public/marketing/evidence/contact-*.png`) is the controlled broken/healthy sibling. Live worker+browser of that fixture is the production dogfood after SHA match.

## Not done until live SHA matches HEAD

Record SHA, `growth:verify-live` output, and stranger dogfood gaps below after Railway SUCCESS.
