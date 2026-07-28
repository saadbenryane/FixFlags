# Post-auth plan picker and scan loading

## One loading

The landing page used to show a `ForegroundScanHandoff` overlay during POST
`/api/checks`, then full-page navigate to `/report/[id]`, then show the
`ReportLoading` server boundary, then the real `AuditReportProgressive`. That
read as two loading screens. Removing the overlay and rendering
`AuditReportProgressive` directly from `app/report/[id]/loading.tsx` collapses
the server boundary into the same scan UI, so the user sees one continuous
"Step 1 of 5 · Queued" → "Step 2 of 5 · Capturing" experience.

## Signup dialog body

The `report-dialog` presentation of `AuthFlow` was rendering a brand-tinted
panel that read "Three complete checks included" plus a body sentence. The
panel is gone. The dialog is now title + subtitle + Google + GitHub + email.
The copy lives in `lib/marketing/copy/auth.ts`; `valueTitle` and `valueBody`
were removed from `AUTH.reportGate`.

## Post-auth plan picker

Every signup and every Free signin now routes to `/onboarding/plans`. The
`/onboarding/plans` page mounts a `PlanPickerDialog` immediately. The picker is
a centered dialog on `sm:` and a bottom sheet on mobile (with a drag handle).

- Free: returns the user to `/dashboard` (or to the active report if one is
  in flight via `getActiveAudit`).
- Pro: same Stripe checkout as the pricing page, via `requestPlanCheckout`.
- Studio: same as Pro.
- Private beta: routes to `/pricing` where the existing `BetaInterestForm`
  takes over.
- Dismiss: writes a session flag so the picker does not pop again this
  session for returning signins; the user goes to `next ?? /dashboard`.
- Paid signins skip the picker entirely.

The decision tree is in `lib/billing/pick-plan.ts`. `PricingCTAButton` and
`PlanPickerDialog` both call it so the picker and the public pricing page
behave identically.

## Files touched

See `.agents/handoffs/scan-loading-signup-picker.md` for the full list and
verification plan.
