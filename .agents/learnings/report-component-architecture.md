# Report Component Architecture

## Layout

- `components/audit/` — page-level report layout: hero, toolbar, rubrics panel, actions, progressive scanning
- `components/report/` — flag interaction: explorer (master-detail), detail panel, fix loop, scoring components
- `components/ui/` — shared primitives: FilterPill, ScoreDot, ThumbsFeedback, Button, Card, etc.

## Shared Utilities

- `lib/audit/share-status.ts` — `shareStatusMessage(status, criticalCount, totalFlags?)` for share readiness messages
- `lib/audit/duration.ts` — `durationFromTimestamps(ms, started, completed)` for audit duration display
- `lib/report/explorer-model.ts` — builds `ReportExplorerModel` from live/partial/sample data
- `lib/report/explorer-filters.ts` — filter logic: severity, rubric, page filters + flag counting

## Filter System

- `FilterPill` in `components/ui/filter-pill.tsx` accepts optional `icon` prop (LucideIcon)
- Rubric filters use `rubricIcon()` from `lib/utils.ts` (MessageSquare/Zap/Globe2)
- Severity filter uses `AlertTriangle` icon
- Page filter uses `Globe` icon
- All filter state managed in `ReportExplorer.tsx` via `useState` hooks

## Component Reuse

- `ThumbsFeedback` in `components/ui/thumbs-feedback.tsx` — shared thumbs-up/down + comment for both flag-level and report-level feedback
- `ScoreDot` in `components/ui/score-dot.tsx` — colored dot for score display, used in hero and toolbar
- `ScoreRingGauge` in `components/report/ScoreRingGauge.tsx` — SVG ring gauge for overall score
- `RubricScoreBar` in `components/report/RubricScoreBar.tsx` — horizontal progress bar per rubric
