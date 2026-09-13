# CI verify after ranking-map unwrap fails on UI drift, not types

**Date:** 2026-09-13
**Scope:** `lib/improvements/service.ts`, `scripts/ui-drift-guard.mjs`, product surfaces
**Confidence:** HIGH
**Evidence:** GitHub Actions `34592200505` on `50c41f4` failed `tsc` because `rankFlagsByPriority` returns `{ flag, rubricName, rubricGrade }`. `34593043492` on `ea0173b` already unwraps `.map(({ flag }) => flag)` and `tsc` passed; verify then exited 1 on `ui:drift-guard` (`font-display` on `/new`, Shopify workspace, Site board; `rounded-xl` panels and `text-[10px]` on Site board). Local `npx tsc --noEmit --incremental false` is clean on that unwrap; `npm run ui:drift-guard` fails until those class tokens are replaced.

`rankFlagsByPriority` is a ranked wrapper, not an `ImprovementFlag[]`. Product surfaces must use Inter (`font-sans` / default heading), `rounded-card`, and `text-2xs`/`text-3xs`. Inter Tight `font-display` is marketing/pricing only.
