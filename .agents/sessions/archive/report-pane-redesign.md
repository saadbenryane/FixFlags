# Session: Report pane redesign

**Date:** 2026-08-17
**Task:** `report-pane-redesign` (closes `living-review-chat-chrome` and `preview-stage-launchpad`)
**Branch:** `main`

## Outcome

Report mode of the living review editor is now a pane-native master/detail surface instead of a sixteen-section scrolling document.
The same three rows render on the homepage emulation, `/samples`, a live scan, a completed report, and historical observations in the Product spine.

| Row | Component |
|-----|-----------|
| Outcome | `components/report/ReportOutcomeBar.tsx` |
| Body | `components/report/ReportExplorer.tsx` inside `data-report-frame` (`WORKSPACE_REPORT_FRAME_CLASS`) |
| Review context | `components/report/ReportContextDisclosure.tsx` |

## What changed

- Added `@tailwindcss/container-queries` and made the explorer pane-relative: `@container/pane` with a `@[40rem]/pane:` split, no `lg:` breakpoint, no `100vh` cap, no `--header-offset` sticky, no `overflow-clip` shell.
- Gave the frame one pane height above the split width so the list and the detail each scroll internally, and released that height below it so a narrow pane scrolls as one column.
- Moved score, unresolved count, Critical shortcut, verdict, history, and scan progress into one outcome bar, and clamped the verdict to two lines so the bar cannot push the fix list out of the pane.
- Collapsed stack, contract, memory, funnel, previews, launch gates, feedback, and pipeline proof into one disclosure that opens by user action or a matching anchor.
- Made `goToFlag` and report anchors scroll the nearest scroll parent (`lib/report/scroll-to-section.ts`).
- Fixed `ReportWorkspaceSplitShell` to render each column once and toggle visibility with CSS. Two DOM trees had produced duplicate `#report-status`, `#report-flags`, and `#selected-flag-detail` ids.
- Removed duplication: one fix count, one aggregate prompt plus compact per-flag lock lines, one `/samples` CTA, one recheck entry point, `rounded-card` on every in-pane box.
- Deleted `ReportWorkspace`, `ReportWorkspaceShell`, `ReportWorkspaceChrome`, `ReportStickyToolbar`, `ReportFixListHeader`, `RubricBar`, `DashboardReleaseHub`, the `sticky_nav_used` event, and the unused `ANON_VALUE_STRIP` copy, with their tests.

## Proof

`node scripts/report-pane-proof.mjs http://localhost:3000 --live https://example.com` at 375, 768, and 1280 across the homepage emulation, `/samples`, a real anonymous `example.com` review while it scanned, and the same review after it completed.
Every row reported one explorer, no duplicated ids, a collapsed Review context, the fix list inside the visible pane, and in split mode a frame that fits the pane with a detail column that scrolls inside it.
Artifacts: `.agents/artifacts/report-pane/`.

Green: `npx tsc --noEmit`, `npm run lint`, `ui:drift-guard`, `skills:validate`, `knowledge:duplication-guard`, `completeness:audit`, `routes:contract-guard`, `product:contract-guard`, `seo:guard`, `test:scripts`, `test:unit` (4500 passed), `test:coverage`, `accuracy:eval`, `test:cli`, `next-build`, `worker:build`.

Not verified: the `docker build -t fixflags:verify .` gate. The Docker registry was unreachable from this machine, so the build stalled on `load metadata for docker.io/library/node:22-bookworm-slim` and `docker pull node:22-bookworm-slim` returned nothing. This is an environment failure, not a code failure, and it needs one clean container build before release.

## Notes for the next agent

Container width is not viewport width: at a 1280px viewport the homepage pane measures 527px and `/samples` measures 756px, so the same viewport renders both the stacked and the split layout.
Never reason about the explorer in viewport terms.
Full findings are in `.agents/learnings/living-review-editor.md`.
