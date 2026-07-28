# Codebase Cleanup — 2026-07-28

## What shipped

- **Removed dead features:** LLM page-purpose (USE_LLM_PAGE_PURPOSE), semantic-slop LLM (USE_SEMANTIC_SLOP), inert RUM capture, unused `_ariaSnapshot` capture/param.
- **Hardened invariants:** A11y metadata fallback gated on `axeViolations == null`; ANON_IP_SOFT_LIMIT lowered from 5 → 1; session stripped to `{ user: { id } }` in `getGatedAuditForRequest`.
- **Public route renamed:** `/api/reports/[id]/monitoring` → `/api/reports/[id]/re-check` (client caller updated).
- **Design consistency:** Canonical `rubricTint()` added to `lib/rubric-icons.ts`; label functions moved to `copy/brand.ts`; `rounded-nested-lg` added to Tailwind config.
- **tsc/type regression fixes:** credits.ts (unreachable FREE check), ReportFixLoop.test.tsx (stale `variant` prop), homepage-message.test.ts (copy barrel shape), missing ReportAuthGate imports, duplicate import cleanup.

## Verification

- `npx tsc --noEmit`: **0 errors**
- `npm run build`: **passed**
- `npm run accuracy:eval`: 3 pre-existing fixture mismatches (bolt-new, html5up, shopify-com)
- `npm run accuracy:browser`: **0 failures** (14 targets)
- Audit unit tests: 953 passed, 10 pre-existing failures (accuracy fixtures), 2 skipped
- Homepage + ReportFixLoop tests: 32 passed

## Canonical refactor checklist (for future sessions)

1. **Feature flags:** Ship on by default or remove entirely. No gated dead code.
2. **Label/copy functions:** Belong in `lib/marketing/copy/brand.ts` (re-exported from barrel). `lib/utils.ts` provides backward-compatible re-exports.
3. **Rubric icons/tints:** Defined once in `lib/rubric-icons.ts`. No in-component hardcoded maps.
4. **Public boundaries:** Use product terms (re-check, not monitoring).
5. **Session in responses:** Return only `{ user: { id } }`, not the full auth object.
