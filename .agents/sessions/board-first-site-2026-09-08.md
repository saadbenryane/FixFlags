# Board-first Site — session receipt 2026-09-08

## Outcome

Implemented the board-first Site product slice and **cut over the primary customer handoff**: Care homepage kept, URL submit opens `/sites/[siteId]` with checking cards only (no `AuditReportProgressive` / Agent|Report shell), Free weekly Keep watching, report stays compatibility.

## What shipped

1. **Hero copy** — `FixFlags looks after what your website depends on, tells you when something needs attention, and helps you get it working again.` Brand/SEO/quiet/pricing aligned.
2. **Domain** — `lib/sites/` adapter over Project + `ProvisionalSite`; `SitePage` / `SiteOutcome`; check→card mapping; coverage facts; Flag projection from Improvements/audit Flags.
3. **Board shell** — `app/sites/[siteId]` Dashboard · Flags · Site; `SiteBoard` UI; `/report` remains compatibility; `/products/[id]` redirects to `/sites/[id]`.
4. **Flag depth** — card detail + `/sites/.../flags/[flagId]` with Fix this (copy) and Verify fix (fresh analysis).
5. **Keep watching** — Free weekly, Pro/Studio daily; claim merges provisional Sites; “You’re covered” only after schedule set.
6. **Handoff cutover (Game On)** —
   - Removed full-screen `AuditReportProgressive` portal from `AuditInput` (spinner on the button only).
   - `startScanWithHandoff` **requires** `siteId` and opens `/sites/{siteId}` only (`SITE_HANDOFF_MISSING` if absent; no `/report` fallback).
   - `createAndEnqueueAudit` ensures Site **before** enqueue; empty/failing ensure fails the audit closed.
   - Re-check API returns `siteId` + `siteUrl`; ActiveAuditBanner → Site; watch emails → Site board; e2e public/credentialed journeys assert `/sites/`.
   - Checking UX: “Learning your website”, checking rings, no fake % health / score-as-health while in flight.

## Schema

Migration: `prisma/migrations/20260908150000_site_board_entities/migration.sql`  
**Applied locally** via `npx prisma migrate deploy` against `.env.local` on 2026-09-08.

## Verification

- Unit (95 focused): handoff, AuditInput (no report chrome), ActiveAuditBanner, monitoring/re-check siteId, create-audit, checks route, task-contracts, Update-review navigations.
- Runtime packaging proof (DB): provisional `siteId` `p_…`, `loadSiteHome` returns status “Learning your website” and 6 checking cards (Site + Security/Search/Performance/Conversion/Tracking). Artifact: `.agent-work/proof-board-cutover.mts` run output.
- e2e expectations updated for `/sites/` (full queue path still gated by `E2E_FULL` / credentialed env).

## Honesty

Homepage board preview remains illustrative until a live Site is opened. Connection metrics (revenue, campaigns) are not invented on public-only cards. Full browser stranger pass with live worker remains the last external gate when the local Next+worker stack is running.
