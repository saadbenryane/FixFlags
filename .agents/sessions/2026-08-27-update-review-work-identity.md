# Update review: one work identity

**Status:** in progress  
**Board:** `update-review-work-identity`  
**Goal:** Update review navigates to and polls the in-flight work audit id (same identity as `/api/checks`), not the completed parent.

## Checklist

- [ ] Re-check JSON: `reportId` = work; drop `workReportId`
- [ ] Active-only attached work resolve + redirect; progressive poll id = work
- [ ] Product + Report handoff via `startScanWithHandoff` → work URL
- [ ] Tests + agent verify + learning

## Notes

Root cause: inverted `reportId` (parent) after stay-on-parent handoff; status poll uses route id → COMPLETED idle UI. Open review used child id and worked.
