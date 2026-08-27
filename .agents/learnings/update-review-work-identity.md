# Update review must open the work report id

Validated 2026-08-27.

- `/api/reports/[id]/re-check` returns `reportId` as the in-flight work audit
  (same meaning as `/api/checks`). `parentReportId` is the baseline only.
  Do not invert `reportId` to the parent or introduce a second `workReportId`
  field for handoff.
- Product and Report Update review both use `startScanWithHandoff` and navigate
  to `/report/{reportId}` so status polling keys the same audit SSR renders.
- Parent bookmarks redirect to an active attached child via
  `resolveActiveAttachedWorkId`. Completed parent URLs stay on that parent.
- Symptom of the inverted contract: Update review landed on a completed idle
  report; Open review (child id) showed the real progressive scan.
