# Site board Game On integrity — session receipt 2026-09-08

## Outcome

Finished the incomplete integrity work after board-first cutover: private Site access, honest coverage (no fake all-green), claim migrates Outcomes/pages, dashboard/Sites IA without report-as-product CTAs, Flag/watch polish, and focused tests green.

## What shipped

1. **Tenancy** — `lib/sites/access.ts` + `request-access.ts`; SSR and `/api/sites/*` gated; provisional access by session key or anon audit cookie; owned Sites owner-only; deny → 404.
2. **Scoped claim** — `claimProvisionalSitesForProject` only updates rows tied to claimed audit ids; `migrateProvisionalSiteDataToProject` moves SitePage/SiteOutcome (keeps user confirmation).
3. **Honest coverage** — areas without evidence stay **unknown**; no shared REACH score across Security/Search/Tracking; PARTIAL treated as finished; last-known retained while re-checking; dead Add card removed.
4. **Sites IA** — dashboard “Your Sites”, rows → `/sites/{id}`, empty → `/new`; Open Site (not Open review); pick-plan no auditId→`/report` bounce; handoff stores `siteId` on active audit; status exposes `siteId`/`projectId`; `/new` copy Site-board; keep-email “Open your results”.
5. **Watch** — client requests best cadence; server clamps to entitlement (Free weekly / paid daily).
6. **Flag page** — honest verify label; Outcomes show linked page URL.

## Verification

- Unit: access, coverage/last-known, claim migrate, handoff active siteId, pick-plan, ProductReviewAction, ActiveAuditBanner, AuditInput (48+ focused; claim/create suites also run).
- Live Next+worker stranger path remains the external gate when the local stack is up; packaging + access contracts are designed, not papered with report fallbacks.

## Explicitly deferred (honest)

Add-card library, Uptime product, connection metrics, pin/reorder, retiring `/report` routes entirely.
