# Learning: the living review editor

**Date:** 2026-08-17 · **Updated:** 2026-08-29  
**Tasks:** `immersive-agent-workspace`, `fullbleed-living-review`, `living-review-game-on`, `preview-stage-launchpad`, `living-review-chat-chrome`, `report-pane-redesign`, `game-on-wedge-honesty`  
**Supersedes:** `fullbleed-living-review.md`, `living-product-review-workspace.md`

## Current product surface (2026-08-29)

The live `/report/[id]` workspace is **Agent beside Report only**.
Preview, Timeline, and Canvas stay parked: they are not loaded on that route and have no customer alternate route until an explicit unpark.
Mobile tabs are **Agent** and **Report**.
Update-review outcomes live on `/products/[id]` under the score chart.
There is no Compare page; `/compare/[id]` redirects to the report.
Homepage marketing emulates Agent|Report with curated sample evidence and deterministic Agent messages. It does not pass Preview playback props into the shell.

Older bullets below that describe Preview-first defaults, transport scrub, four-tab mobile bars, or opening Timeline after completion are **historical** for when those surfaces unpark. Do not treat them as live requirements.

## Finding

A living Product review is understood when the interface separates **FixFlags understanding** from **Product reality**, and it is trusted when neither of those panes moves while the review streams in.

Three failures kept recurring and each traced to a specific structural decision, not to taste:

1. **Layout drift.** As long as more than one report layout existed, one of them silently became the ugly one. Owners with history, curated `/samples`, and the homepage all diverged before they were folded into the same shell.
2. **Layout shift.** Any element whose height derives from content that arrives later will move the page.
3. **Chrome inside chrome.** A drawn browser bar inside a pane that already has a header duplicates identity.
4. **Viewport thinking inside a pane.** A component written for a full page keeps working visually and stops working structurally once it is embedded.

## Durable prevention (still true)

- One immersive `ReportWorkspaceSplitShell` for every non-error report: scanning, completed, owners with score history, and curated `/samples`. Score, Flags, and actions live in Report mode. No hero document above the split.
- Agent column is chat: bubble transcript, one Flag working mark, one-row ArrowUp composer. Anonymous submit gates to sign-in.
- Small screens use one tab bar (Agent, Report) over the same Product pane.
- The immersive shell renders no floating support bubble.
- Homepage and samples reuse `LiveReportExplorer` / `ReportExplorer`. Never call `/api/checks` from a marketing surface.
- `/samples` embeds the live editor in a fixed-height card. `AuditReport` must use `h-full` for `variant="sample"`.
- Agent identity uses `displaySiteAddress`, not hostname.
- `ReportExplorer` writes `?flag=` only when it has a live `auditId`.
- The Agent names at most three Flags via shared ranking (`compareFlagPrioritySignals` / `selectAnnouncedFlags`).
- Report mode is the compact `ReportOutcomeBar` plus the explorer body. Product context and outcome cards live on `/products/[id]`.
- Everything inside the pane is pane-relative (`@container/pane`). No `lg:`, `100vh`, `--header-offset`, or `overflow-clip` on the explorer.
- Each column renders once and toggles with `flex`/`hidden` to avoid duplicate report ids.
- Demo identity is **Launchpad** at `fixflags.com/demo`.

## Parked surfaces (do not teach as live)

When Preview is unparked again, restore: constant stage geometry, `BrowserFrame chrome="none"`, docked `WorkspacePreviewTransport`, measured evidence overlays, and honest gated transport. Until then, do not reintroduce Preview props into `ReportWorkspaceSplitShell`.

## Proof

- `components/report/__tests__/ReportWorkspaceSplitShell.test.tsx` asserts only Agent and Report tabs and normalizes legacy Timeline/Canvas view params to Report.
- `components/report/__tests__/workspace-geometry.test.ts` keeps report frame free of viewport units.
- `components/report/__tests__/ReportOutcomeBar.test.tsx` asserts the outcome is stated once.
- `scripts/report-pane-proof.mjs` opens Report mode at 375, 768, and 1280.
