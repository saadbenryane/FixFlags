# Learning: the living review editor

**Date:** 2026-08-17
**Tasks:** `immersive-agent-workspace`, `fullbleed-living-review`, `living-review-game-on`, `preview-stage-launchpad`, `living-review-chat-chrome`, `report-pane-redesign`
**Supersedes:** `fullbleed-living-review.md`, `living-product-review-workspace.md`

## Finding

A living Product review is understood when the interface separates **FixFlags understanding** from **Product reality**, and it is trusted when neither of those panes moves while the review streams in.

Three failures kept recurring and each traced to a specific structural decision, not to taste:

1. **Layout drift.** As long as more than one report layout existed, one of them silently became the ugly one. Owners with history, curated `/samples`, and the homepage all diverged before they were folded into the same shell.
2. **Layout shift.** Any element whose height derives from content that arrives later will move the page. A capture sized by device aspect ratio changes pane height roughly threefold between desktop (1280x900) and mobile (375x812), and a findings strip that mounts on its first result pushes the fix list down mid-read.
3. **Chrome inside chrome.** A drawn browser bar inside a pane that already has a header duplicates identity, steals vertical space from the actual page, and makes the capture read as a picture of a website instead of the website.
4. **Viewport thinking inside a pane.** A component written for a full page keeps working visually and stops working structurally once it is embedded. `ReportExplorer` used `lg:` breakpoints, `100vh` caps, and `--header-offset` sticky inside a pane that is neither the viewport nor below the site header, so at a 1280px viewport the 527px homepage pane got the desktop layout rules and none of the desktop space.

## Durable prevention

- One immersive `ReportWorkspaceSplitShell` for every non-error report: scanning, completed, owners with score history, password shares, and curated `/samples`. Score, Flags, context, and actions live in Product Report mode. No hero document above the split.
- The Product pane is exactly three rows: header, stage, transport.
  - Header carries the Product name and the reviewed address including its path (`displaySiteAddress`), because nothing else does once the fake chrome is gone. Hostname alone turned the demo review of `fixflags.com/demo` into an apparent review of `fixflags.com`.
  - Stage uses `WORKSPACE_STAGE_CLASS` and letterboxes the capture with `object-contain object-center`. The capture never sizes the stage.
  - The stage is a flex column, not a block. Its small-screen height comes from `min-h`, and `height: 100%` against a parent with only a minimum height resolves to auto, so the capture measured zero on every stacked pane while the stage box still measured correct. Measure the image, not only the container.
  - Transport (`WorkspacePreviewTransport`) is a `shrink-0 border-t` sibling of the stage, never inside the scroll area, with one fixed height in every state.
- `BrowserFrame` takes `chrome="none" fill` inside the editor. `chrome="browser"` is only for marketing and compare surfaces that have no pane header.
- Captured evidence enters with the opacity-only `capture-fade`. `fade-in-up` translates, so it must not be used on anything inside a fixed stage.
- Controls degrade honestly rather than disappearing. Gated viewers keep the device control and the Timeline gate message; they never receive step chips, a scrub, or step payload.
- Reserve space before it is needed: the findings strip holds its row from the moment findings can stream, progress readouts use `tabular-nums` in a fixed-width slot, and a mid-scan action such as "Inspect N Flags" occupies a reserved slot in the header.
- Active scanning defaults to Preview; completed reviews default to Report. Technical execution logs and simulated reasoning never enter the transcript.
- Small screens use one tab bar (Agent, Preview/Timeline, Report, Canvas) over the same Product pane, driven by the same `view` state as the desktop toggle. A separate scanning tab bar and a completed "Back to Agent" row meant the mobile shell changed shape the moment a scan finished, which measured as a 119px jump.
- The immersive shell renders no floating support bubble. The Agent column is the chat surface, and the launcher sat on top of the docked transport at 375.
- Agent column is chat, not an IDE log: bubble transcript, one Flag working mark (animated while scanning), one-row ArrowUp composer. Anonymous submit gates to sign-in. A "Working · 82%" strip above the transcript duplicated the active bubble and made the left pane feel like a status panel.
- Device icons (Monitor / Smartphone) live in the Product header next to Preview. Putting them in the transport fought the scrub and made Preview feel like a media player with the wrong primary control.
- Homepage Report mode must render `ReportExplorer` master/detail + `FixPromptBlock`. Hand-rolled Flag cards lost list navigation and the real copy prompt.
- Marketing emulations import the same geometry constants, the same transport, and the same `WorkspaceMobileTabs` one-pane small-screen shell. Stacking Agent above Product on a marketing card buries the capture: homepage 375 showed only the transcript, and 768 left a postage-stamp stage. Never call `/api/checks` from a marketing surface.
- `/samples` embeds the live editor in a fixed-height card. `AuditReport` must use `h-full` for `variant="sample"`. The live `h-[calc(100dvh-3.5rem)]` shell inside that card clips the docked transport. The card itself must leave room for the page title (`h-[min(calc(100dvh-16rem),54rem)]`); `80vh` plus the heading pushed the transport below the fold.
- Agent identity uses `displaySiteAddress`, not hostname. Hostname-only turned `fixflags.com/demo` into an apparent review of `fixflags.com` in the chat header after the Product pane was already fixed.
- Proof scripts click icon-only device tabs by accessible name (`getByRole('tab', { name: 'Mobile' })`), open Preview or Timeline after completion, and exit 1 when the stage is missing, unstable, or undocked. Logging JSON is not a pass.
- Homepage scan proof must use `getByLabel('Website URL')` and click **Review my site**. The hero field is `type="text"` `name="url"` and stays disabled until hydrate. `input[type="url"]` is the wrong control.
- `ReportExplorer` writes `?flag=` only when it has a live `auditId`. Without that guard the homepage curated story rewrites `/` to `/?flag=flag-experience-1` while a visitor is trying to start a review.
- The Agent names at most three Flags, selected by `selectAnnouncedFlags`: severity first, then Message/Experience over Reach, then non-SEO over SEO, then the existing Finish Plan comparator. Discovery order announced meta description / og:image / og:title on example.com. The Report still lists every confirmed Flag. Do not change Finish Plan ranking to fix the transcript.
- Shared ranking lives in `compareFlagPrioritySignals`. After severity, SEO / sharing / measurement Flags are demoted so an Important headline Flag outranks an Important meta-description Flag, while Critical SEO still outranks Important Experience. Agent announcement now uses that same comparator. Do not keep a second announcement-only ranker.
- Prove ranking through `groundedReportVerdict`, not only the comparator. That is the shipped "Highest priority" string customers read.
- Next constraint: whether the top-ranked Flag is actually true. Ranking cannot save a false-positive CTA or headline. HTML-only accessible-name counts are now POLISH so they cannot lead Linear or Replit. Production mobile-CTA verdict integrity is owned by `continuous-improvement-system` and remains blocked for this writer.
- Report mode is the compact `ReportOutcomeBar` plus the explorer body. Product context lives on `/products/[id]`. Before this, the pane was a 16-section document and the fix list, the one thing the report exists for, sat mid-scroll behind a verdict, callouts, a score band, a recheck strip, a polish pass, and a fix header.
- Everything inside the pane is pane-relative. `ReportExplorer` uses `@container/pane` with a `@[40rem]/pane:` split and carries no `lg:`, `100vh`, `--header-offset`, or `overflow-clip`. `overflow-clip` on the shell also killed the sticky detail it was paired with, so the two rules had cancelled each other out for as long as both existed.
- Container width is not viewport width and the gap is large: at a 1280px viewport the homepage pane measures 527px and `/samples` measures 756px, so the same page renders both the stacked and the split layout at one "desktop" width.
- A wide pane gives `data-report-frame` exactly one pane height and each column scrolls itself; a narrow pane releases that height and scrolls as one column. Asserting "the pane never scrolls" is wrong, because the Review context row is a sibling below the frame and is supposed to be reached by scrolling.
- Anything in the outcome bar that grows with content can push the fix list out of the pane. An unclamped verdict made the bar 537px tall at 375, which put the list below the fold on the surface where the list matters most. The verdict is clamped to two lines with the full text in `title`.
- Rendering desktop and mobile variants as two DOM trees produced duplicate `#report-status`, `#report-flags`, and `#selected-flag-detail` ids. Anchors, `goToFlag`, and every proof measured whichever copy came first, which was often the hidden one. Each column now renders once and toggles with `flex`/`hidden`.
- Filters are always visible. `lg:hidden` on severity, impact, and page filters hid them exactly when the pane was narrow, which is when filtering a long list matters most.
- Duplication is a structural symptom, not a copy problem. The unresolved count existed in two components, the aggregate prompt in two, `/samples` had two primary CTAs, anonymous viewers had three signup surfaces, and recheck had two entry points, all because no single row owned the outcome.
- The demo has one identity everywhere: **Launchpad** at `fixflags.com/demo`, labelled as a demo via `DEMO_BRAND.displayLabel` / `DEMO_FIXTURE_CONTEXT_TAG`. Its intentional defects are structural (CTA below the mobile fold, generic headline, missing trust, slow signup destination, broken scroll reveal, slow bundle, oversized mobile hero), so re-theming the fixture preserves every one of them.

## Proof

- `components/report/__tests__/ReportWorkspaceSplitShell.test.tsx` asserts no chrome-in-chrome, a single URL in the pane header, a docked transport including while scanning and for anonymous viewers, unchanged stage classes across a device switch, and no step payload for gated viewers.
- `lib/demo/__tests__/demo-identity.test.ts` asserts the Launchpad identity across brand, both fixtures, curated evidence, and SEO, and that every intentional defect survives.
- `scripts/preview-stage-proof.mjs` measures the stage box before and after a device switch at 375, 768, and 1280 on the homepage emulation and a completed report.
- `scripts/scanning-shell-proof.mjs` starts a real anonymous review and samples the stage while the transcript and Flags stream in at all three widths.
- `components/report/__tests__/workspace-geometry.test.ts` keeps the stage a flex column with its small-screen floor, keeps the report frame free of viewport units, and fails if `ReportExplorer` reintroduces `lg:`, `100vh`, `--header-offset`, or `overflow-clip`.
- `components/report/__tests__/ReportOutcomeBar.test.tsx` asserts the outcome is stated once.
- `scripts/report-pane-proof.mjs` opens Report mode at 375, 768, and 1280 on the homepage and `/samples`, and fails on duplicated report ids, a fix list below the pane, a split pane whose frame overflows, or a detail column that does not scroll inside the pane.
