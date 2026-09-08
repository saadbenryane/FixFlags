# Board-first Site — session receipt 2026-09-08

## Outcome

Implemented the board-first Site product slice: Care homepage kept and polished, URL checks land on `/sites/[siteId]` card board, existing scan Flags package into board areas, Fix/Verify from cards, Free weekly Keep watching, Products redirect to Sites.

## What shipped

1. **Hero copy** — `FixFlags looks after what your website depends on, tells you when something needs attention, and helps you get it working again.` Brand/SEO/quiet/pricing aligned.
2. **Domain** — `lib/sites/` adapter over Project + `ProvisionalSite`; `SitePage` / `SiteOutcome`; check→card mapping; coverage facts; Flag projection from Improvements/audit Flags.
3. **Board shell** — `app/sites/[siteId]` Dashboard · Flags · Site; `SiteBoard` UI; handoff via `startScanWithHandoff` → `/sites/{siteId}`; `/report` remains compatibility; `/products/[id]` redirects to `/sites/[id]`.
4. **Flag depth** — card detail + `/sites/.../flags/[flagId]` with Fix this (copy) and Verify fix (fresh analysis).
5. **Keep watching** — Free weekly, Pro/Studio daily; claim merges provisional Sites; “You’re covered” only after schedule set.
6. **Cutover** — sidebar “Sites”; samples labeled legacy report; Shopify connection fence retained.

## Schema

Migration: `prisma/migrations/20260908150000_site_board_entities/migration.sql`  
Apply with `npx prisma migrate deploy` (or `db push`) where `DATABASE_URL` is available.

## Verification

- Unit: card packaging, entitlements (Free watch), create-audit siteId, project-watch Free weekly / daily gate, checks route siteId.
- Runtime browser path for stranger URL→board requires DB migration + worker.

## Honesty

Homepage board preview remains illustrative until a live Site is opened. Connection metrics (revenue, campaigns) are not invented on public-only cards.
