# Preview stage and Launchpad demo

**Status:** in progress
**Board:** `preview-stage-launchpad` (closes `living-review-game-on`)
**Started:** 2026-08-16

## Condition

1. The Product pane is three fixed rows: header, stage, transport.
2. No fake browser chrome inside the editor; the reviewed URL lives in the pane header.
3. The stage never resizes when the viewer switches device or selects a step.
4. The transport is docked in every state, including scanning, mobile, and anonymous, and leaks no Timeline payload.
5. Nothing that streams in mid-review reflows its neighbours.
6. The demo reads Launchpad everywhere, screenshots included, with every intentional defect preserved.
7. Docs, skills, learnings, and tests prevent regression.

## What changed

| Area | Change |
|------|--------|
| `components/audit/BrowserFrame.tsx` | Added `chrome: 'browser' \| 'none'` and `fill`. Fill mode drops aspect-ratio sizing so the capture letterboxes inside a parent-owned stage. Capture entry is now opacity-only `capture-fade`. |
| `components/report/WorkspaceBrowserPanel.tsx` | Reduced to a pure stage: no toggle row, no `mx-auto max-w-[24rem]` mobile clamp, no chrome. Device is a controlled prop. |
| `components/report/WorkspacePreviewTransport.tsx` | New docked transport: device control, scrub, step chips, capture status, honest gated state. One fixed height in every state. |
| `components/report/ReportWorkspaceSplitShell.tsx` | Product pane restructured into header / stage / transport. Pane header now carries the reviewed hostname. Mid-scan "Inspect N Flags" action occupies a reserved slot. |
| `components/report/LivingReviewEmulation.tsx` | Same three-row anatomy and the same transport, so marketing cannot drift from the live editor. |
| `components/report/workspace-geometry.ts` | Added `WORKSPACE_STAGE_CLASS` as the one stage geometry both surfaces import. |
| `components/report/WorkspacePlaybackStrip.tsx` | Deleted. The transport supersedes it; `PlaybackStep` now imports from `lib/audit/playback-steps`. |
| `components/audit/AuditReportProgressive.tsx` | Findings strip holds its row from the moment findings can stream. |
| `components/marketing/landing/HomepageReportPreview.tsx` | Taking over the curated story pins the current view, so a device click no longer swaps the pane. |
| `lib/audit/viewports.ts` | Removed four dead stacked-frame constants. |
| Demo | `Launchpad` brand, both fixtures re-themed as a launch-checklist SaaS with all defects intact, curated evidence and SEO aligned, `/samples/demo-original-*.webp` re-captured. |

## Proof commands

```bash
npx vitest run components lib --reporter=dot
npm run validate:quick
npm run ui:drift-guard
npm run agent -- verify
node scripts/preview-stage-proof.mjs http://localhost:3000
```

## Phases

- [x] Phase 1 stage sizing and chrome modes
- [x] Phase 2 docked transport
- [x] Phase 3 shift and polish sweep
- [x] Phase 4 Launchpad demo rewrite
- [x] Phase 5 contract tests
- [x] Phase 6 docs, skills, learnings, board
- [~] Phase 7 verify gate and browser proof — homepage + /samples at 375/768/1280 passed with failing proof scripts; live scanning-shell-proof and full `npm run agent -- verify` still open
