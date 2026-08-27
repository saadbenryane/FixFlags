# Update review: one work identity

**Status:** review  
**Board:** `update-review-work-identity`  
**Goal:** Update review navigates to and polls the in-flight work audit id (same identity as `/api/checks`), not the completed parent.

## Checklist

- [x] Re-check JSON: `reportId` = work; drop `workReportId`
- [x] Active-only attached work resolve + redirect; progressive poll id = work
- [x] Product + Report handoff via `startScanWithHandoff` → work URL
- [x] Tests + agent verify + learning

## Notes

Root cause: inverted `reportId` (parent) after stay-on-parent handoff; status poll uses route id → COMPLETED idle UI. Open review used child id and worked.

Proof: focused vitest green; `npm run agent -- verify` passed 2026-08-27.
Learning: `.agents/learnings/update-review-work-identity.md`
