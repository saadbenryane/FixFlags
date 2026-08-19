# Preview highlights must be measured at capture time

- Date: 2026-08-19
- Evidence: `lib/audit/evidence-highlights.ts` previously built preset hero boxes (`y = 0.35`, width `0.82`) when no anchor existed. `tryResolveEvidenceAnchorsForAudit` re-opened the URL with generic CSS (`.demo-cta-primary`, `main`). Product Preview never passed `BrowserFrame.viewportOverlay`.

A highlight that was not measured on the same page, same scroll, and same screenshot is a guessed overlay. Persist `Flag.evidenceTargets` from the capture harvest. Draw `EvidenceSpotlight` only for `source: 'measured'` element rects. Page-scope and unmeasured Flags get a chip.

Prevent recurrence with `lib/audit/__tests__/evidence-targets.test.ts` and the inverted evidence-highlights test that expects zero boxes without measurements.
