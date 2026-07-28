# Scan loading + signup dialog + plan picker modal

## Goal

1. Collapse the double loading state on the landing page into one continuous scan experience.
2. Trim the signup popup to buttons only (no "Three complete checks included" value panel).
3. Show a mobile-friendly plan picker modal after every signup and every Free-plan signin, with Free re-claiming the pending report.

## Changed files

- `components/audit/AuditInput.tsx` — drop `ForegroundScanHandoff`, drop the body-scroll lock overlay.
- `app/report/[id]/loading.tsx` — render `AuditReportProgressive` with `status="QUEUED"` so the server boundary is invisible (it just renders the same progressive UI before the real audit resolves).
- `lib/marketing/copy/landing.ts` — remove `openingReport` and `retrievingReport`.
- `components/auth/AuthFlow.tsx` — drop the brand-tinted value panel in the `isDialog` branch.
- `lib/marketing/copy/auth.ts` — drop `valueTitle` and `valueBody` from `reportGate`.
- `components/auth/__tests__/ReportAuthGate.test.tsx` — assertions updated to match the new dialog.
- `lib/billing/pick-plan.ts` (new) — shared `pickPlan` helper used by pricing and the modal.
- `components/billing/PlanPickerDialog.tsx` (new) — modal on desktop, bottom sheet on mobile.
- `components/billing/PlanPickerDialogHost.tsx` (new) — owns analytics and dismissal memory.
- `app/(auth)/onboarding/plans/page.tsx` (new) — page that mounts the picker immediately.
- `hooks/useAuthRedirect.ts` — extend `navigateAfterAuth` to route Free users (and just-signed-up users) to the picker.
- `app/(auth)/post-login/page.tsx` — small change to forward `from` so post-auth attribution survives the picker.
- `components/pricing/PricingCTAButton.tsx` — delegate plan-pick to the shared helper; honor pending audit for Free CTA.
- `lib/analytics/events.ts` — add `plan_picker_viewed`, `plan_picker_picked`, `plan_picker_dismissed`.

## Invariants respected

- `Marketing copy` lives only in `lib/marketing/copy/`.
- No new `/api/audits` route; the existing `/api/stripe/checkout` and `/api/stripe/beta-interest` paths are reused.
- `useMe({ load: true })` is only invoked from the picker host so the unauthenticated signup flow does not regress.
- The plan picker does not leak gated fix prompts or signup-gate copy as evidence.
- The plan picker is the only place plan selection happens for logged-in users; `/pricing` remains the public surface.
- Re-check remains free; no plan-pick gate is added to re-checks.

## Verification

- `npm run validate:quick`
- `npm run validate:affected`
- `npm run ui:drift-guard`
- `npm run brand:hex-guard`
- `npm run no-em-dash` (via `lib/__tests__/no-em-dash.test.ts`)

## Open follow-ups

- Confirm post-auth handoff keeps the `next` query param through the picker when the user dismisses.
- Confirm billing webhook (`checkout.session.completed`) does not double-fire the picker for paid users.
