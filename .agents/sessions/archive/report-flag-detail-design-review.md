# Report Flag detail design review

Date: 2026-08-25

Scope: read-only review of the two supplied `/samples` screenshots and the current `ReportExplorer`, Flag detail, prompt, CTA, and test code.

## Findings

1. The previous/next behavior already existed but had no visible controls.
`ReportExplorer.tsx` computes the filtered Flag order, selected position, `showPrevious`, and `showNext`, passes both callbacks to `FlagDetailPane`, and supports Left/Right keyboard navigation.
`ReportExplorerDetail.tsx` declared `flagCount`, `onPrevious`, and `onNext` but did not destructure or render them, while its test explicitly asserted that navigation was absent.
The clean placement is in the selected-Flag header, after the title and opposite the meta pills: a quiet `n of N` label plus two shared 44x44 icon buttons named `Previous flag` and `Next flag`.
Keep navigation bounded and disable the first/last unavailable direction; wrapping from rank 1 to the last ranked Flag is surprising in a priority list.
Navigation must follow the currently filtered order and continue updating `?flag=` through the existing URL writer.

2. The expanded prompt looked like a card inside a card because it was one.
`FlagDetailPanel.tsx` creates an outlined rounded disclosure shell, then adds `p-3`, and renders `FixPromptBlock nested render="markdown"` inside it.
The Markdown branch in `FixPromptBlock.tsx` adds another rounded surface, ring, `shadow-card`, a divider, and a visible `Markdown` toolbar.
That produces the inset, left-contained panel visible in the screenshots and adds a third visual hierarchy where one disclosure is sufficient.
Use one prompt shell only: label the disclosure `Fix Prompt`, keep Copy visible in the same header row, and render the Markdown body flat in normal flow under one divider with no inner ring, shadow, radius, or `Markdown` label.
The existing flat-Markdown direction in the working tree addresses the source rather than masking it with spacing.

3. The apparent Review Context collision is a scroll/overflow proof gap.
The screenshots show expanded prompt content and open Review Context visually occupying the same region.
The DOM composition is separate: `ReportPane.tsx` places `ReportExplorer` in `data-report-frame` and `ReportContextDisclosure` after the frame, while wide `ReportExplorer` detail is an independent `overflow-y-auto` column.
In Chromium at a 1021px viewport, the expanded prompt content measured beyond the detail viewport (`1152px` scroll height inside a `384px` client height), while open Review Context began below the frame; clipping was correct there.
This makes the supplied Safari result consistent with a browser-specific paint/overflow failure or stale layout, not with Review Context being nested in the prompt.
Do not move Review Context into the Flag detail.
Verify the final implementation in Safari/WebKit with both disclosures open, and extend `scripts/report-pane-proof.mjs` (or a focused browser test) to expand `Fix Prompt`, open Review Context, and assert that each remains clipped/positioned in its own scroll owner.

4. The black sample CTA came from the default Button variant.
The sample handoff in `AuditReport.tsx` renders `HERO.primaryCta` through `<Button asChild>`, whose default in `components/ui/button.tsx` is the ink/primary treatment.
This is the black `Review my site` button in the supplied screenshot.
The marketing CTA should explicitly use `variant="brand"`, which yields `bg-brand text-brand-foreground` (orange and white) and matches the header CTA.
For the prompt-row Copy action, prefer exposing a Button variant through `PromptCopyButton` and passing `brand` instead of overriding outline styles with page-local classes; that follows the design-system rule to fix shared-action styling at the primitive boundary.

5. Canonical wording and small-width fit need to stay synchronized.
Per-Flag wording belongs in `lib/marketing/copy/report-workspace.ts`; add/use an explorer `Fix Prompt` label rather than hardcoding it in JSX.
Update `knowledge/report-contract.md`, `DESIGN.md`, and the two stale `Preview prompt` references in `design-qa.md` if they describe the per-Flag row.
Do not rename `REPORT_COPY.finishPlan.previewToggle` unless the aggregate Finish Plan surface is intentionally included; it is a separate component and is not the Flag detail shown here.
At 320px the current one-row prompt header can wrap `Fix Prompt` onto two lines because Copy consumes most of the row.
Recheck 320/375px after styling; compact padding or a narrow-label treatment is preferable to horizontal overflow or a two-line control label.

## Exact implementation and verification surface

- Primary components: `components/report/ReportExplorer.tsx`, `components/report/ReportExplorerDetail.tsx`, `components/report/FlagDetailPanel.tsx`, `components/audit/FixPromptBlock.tsx`, `components/audit/PromptCopyButton.tsx`, `components/audit/AuditReport.tsx`.
- Canonical copy/docs: `lib/marketing/copy/report-workspace.ts`, `knowledge/report-contract.md`, `DESIGN.md`, `design-qa.md`.
- Focused tests: `components/report/__tests__/ReportExplorerDetail.test.tsx`, `components/report/__tests__/ReportExplorer.test.tsx`, `components/report/__tests__/FlagDetailPanel.test.tsx`, `components/report/__tests__/ReportPane.test.tsx`, `components/report/__tests__/workspace-geometry.test.ts`.
- Browser proof: `scripts/report-pane-proof.mjs`; include expanded prompt plus open Review Context and 320, 375, 768, and 1280px widths.

## Acceptance summary

- Two visible, accessible 44x44 previous/next controls; correct disabled boundaries; filtered order, URL state, keyboard navigation, and focus behavior remain correct.
- `Fix Prompt` is a single clean disclosure surface with one persistent Copy action and no nested Markdown card/tool label.
- Expanded prompt scrolls only inside the Flag detail at wide pane widths; Review Context remains a distinct sibling below the report frame with no visual overlap in Chromium and WebKit/Safari.
- Customer-facing primary CTAs use the shared brand-orange/white treatment and preserve hover, focus, active, and disabled states.
- No horizontal overflow or clipped/wrapped action labels at 320/375px.

## Root implementation and proof

Implemented the bounded Flag controls in the selected-detail header with a visible `n of N` position, disabled first/last boundaries, filtered-order behavior, URL synchronization, and the existing Left/Right keyboard support.
Flattened per-Flag Markdown rendering inside one `Fix Prompt` disclosure, removed the nested Markdown toolbar/card, and kept the branded Copy prompt action visible in the same row.
Corrected the shared brand Button foreground to `text-brand-foreground` and applied the brand variant to the sample `Review my site` CTA.
Focused component tests passed: 36 tests across ReportExplorer, detail, prompt, pane, and geometry coverage.
TypeScript, focused ESLint, `npm run ui:drift-guard`, `node scripts/report-pane-proof.mjs`, and `npm run agent -- eval ui` passed.
`npm run agent -- verify` passed all nine selected affected-file commands.
Chromium browser proof passed at 320, 375, and 1280px with no horizontal overflow or console errors.
WebKit proof at 1280px passed with both `Fix Prompt` and `Review context` open: the detail remained an independent 384px `overflow-y: auto` scroll owner, context started below the frame, and no paint overlap occurred.
