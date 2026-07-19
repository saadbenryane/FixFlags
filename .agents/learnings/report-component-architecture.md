# Report Component Architecture

## Layout

- `components/audit/` — page-level report layout: hero, toolbar, `RubricBar`, `ShareStatusBanner`, actions, progressive scanning
- `components/report/` — flag interaction: explorer (master-detail), detail panel, fix loop, scoring components
- `components/ui/` — shared primitives: FilterPill, ScoreDot, ThumbsFeedback, Button, Card, etc.

## Shared Utilities

- `lib/audit/share-status.ts` — `shareStatusMessage` for share readiness messages
- `lib/audit/duration.ts` — `durationFromTimestamps` for audit duration display
- `lib/report/explorer-model.ts` — builds `ReportExplorerModel` (optional `visualUrl` from flag visual evidence)
- `lib/report/explorer-filters.ts` — severity, rubric, page filters + flag counting
- `lib/audit/persist-visual-evidence.ts` — GIF/overlay map on `performanceData.flagVisualEvidence`

## Filter System

- `FilterPill` accepts optional `icon` prop (LucideIcon)
- Rubric filters use `rubricIcon()` from `lib/utils.ts`
- Severity filter uses `AlertTriangle`; page filter uses `Globe`
- Filter state lives in `ReportExplorer.tsx`

## Do not resurrect

- `RubricsPanel` — deleted; use `RubricBar` + `ReportExplorer`
- `TestimonialsSection` / carousel — replaced by `ProductEvidenceSection`
