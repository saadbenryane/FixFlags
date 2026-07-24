# Report Component Architecture

## Layout

- `components/audit/` — page-level report layout: hero, toolbar, `RubricBar`, ShareDrawer readiness warning, actions, progressive scanning
- `components/report/` — flag interaction: explorer (master-detail), detail panel, fix loop, scoring components
- `components/ui/` — shared primitives: FilterPill, ScoreDot, ThumbsFeedback, Button, Card, etc.

## Shared Utilities

- `lib/audit/share-status.ts` — `shareStatusMessage` for share readiness messages
- `lib/audit/duration.ts` — `durationFromTimestamps` for audit duration display
- `lib/report/explorer-model.ts` — builds `ReportExplorerModel` (optional `visualUrl` from flag visual evidence)
- `lib/report/explorer-filters.ts` — rubric + page filters + flag counting (severity is sort-only, not a filter)
- `lib/audit/flag-copy.ts` — `buildExpertFixPrompt` emits Markdown (`## Why` / `## Evidence` / `## Fix` / `## Scope` / `## Verify`)
- `components/audit/MarkdownPromptBox.tsx` — lean Fix display (Markdown label + top-right copy); flag detail does not duplicate Why/Evidence/Verify as separate cards
- `lib/audit/persist-visual-evidence.ts` — GIF/overlay map on `performanceData.flagVisualEvidence`

## Filter System

- `FilterPill` accepts optional `icon` prop (LucideIcon)
- Rubric filters use `rubricIcon()` from `lib/utils.ts`
- Page filter uses `Globe`
- No severity filter — flags stay ranked by `compareFlagsByPriority`
- Filter state lives in `ReportExplorer.tsx`

## Flag meta

- Order: `SeveritySignal` (single `CircleAlert`, hover "Critical Flag") → Rubric → Impact
- No Detected/Observed/Reproduced pills in UI chrome (`truthLabel` stays on the model for MCP/API)
- Component: `components/report/SeveritySignal.tsx`
- Flag detail: Fix heading + `MarkdownPromptBox` only (visual/OG media above when present). No Why/Evidence/Verify cards.
- Sidebar has-prompt indicator: `Wrench` (not Sparkles)

## Evidence devices

- `devicesForCheck(checkId)` returns only the issue device(s). Unregistered checks default to desktop (or mobile when the id implies mobile). Never default to both.

## Do not resurrect

- Severity filter pills ("All severities" / "Critical")
- `ShareStatusBanner` — deleted; RubricBar owns rubric status; ShareDrawer shows one fix-before-sharing warning
- `RubricsPanel` — deleted; use `RubricBar` + `ReportExplorer`
- `TestimonialsSection` / carousel — replaced by `ReportExamplesSection` / sample explorer Flag output
- Message gaps / Experience friction / Reach misses naming (use Message / Experience / Reach)
