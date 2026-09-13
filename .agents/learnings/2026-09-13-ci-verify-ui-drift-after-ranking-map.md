# CI verify after ranking-map unwrap fails on UI drift, not types

**Date:** 2026-09-13
**Scope:** `lib/improvements/service.ts`, `scripts/ui-drift-guard.mjs`, product surfaces
**Confidence:** HIGH
**Evidence:** GitHub Actions `34592200505` on `50c41f4` failed `tsc` because `rankFlagsByPriority` returns `{ flag, rubricName, rubricGrade }`. `34593043492` on `ea0173b` already unwraps `.map(({ flag }) => flag)` and `tsc` passed; verify then exited 1 on `ui:drift-guard` (`font-display` on `/new`, Shopify workspace, Site board; `rounded-xl` panels and `text-[10px]` on Site board). Local `npx tsc --noEmit --incremental false` is clean on that unwrap; `npm run ui:drift-guard` fails until those class tokens are replaced.

`rankFlagsByPriority` is a ranked wrapper, not an `ImprovementFlag[]`. Product surfaces must use Inter (`font-sans` / default heading), `rounded-card`, and `text-2xs`/`text-3xs`. Inter Tight `font-display` is marketing/pricing only.

The next guard after UI drift is `image:artwork-guard`. `LandingHowItWorksSection` no longer embeds `/marketing/visuals/how-it-works-workflow-v4.webp`. Leave `consumers: []` when an approved asset is unwired (same pattern as `50419c3f`). Do not invent a new homepage visual to satisfy the guard.

`ensure-site` imported `fromStoredWatchInterval` from `project-watch`, which imported `monitoring`, which imported `create-audit`, which imported `ensure-site`. Move interval helpers to `lib/audit/watch-interval.ts` so Site bootstrap does not load watch scheduling.

Remaining verify failures after those shape fixes:
- `seo:guard`: SEO key `roast` exists in `copy/seo.ts` (`/roast` is noindex and kept out of nav) but is missing from `INDEXABLE_ROUTES`. Do not add it to the sitemap just to silence the guard.
- `security:audit`: `npm audit --audit-level=moderate` fails (Next critical, sharp/js-yaml high, vitest/hono moderate). Dependency upgrades are not a type/shape fix.
