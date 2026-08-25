# Game On report workspace Wave 1

## Outcome

The canonical Review workspace now defaults active desktop reviews to Preview, active mobile reviews to Agent, and completed reviews on every width to Report.
Completed Timeline remains a URL-backed sibling only when the workspace capability permits replay.
Live anonymous, shared, and other non-owner surfaces cannot regain Timeline, Canvas, chat, update-review, or mutation controls by inferring state in a child component.

The Report header is again the single compact Score, chronological Review history, and active progress surface.
It no longer repeats Product identity, dashboard navigation, Fix counts, instructions, or toolbar actions.
Owner report actions moved into the canonical report action/context section.

The complete ranked Fix list is the first working surface.
The category-wide raw aggregate prompt was removed from `ReportExplorer`.
Each eligible Flag now carries only its own prompt, while the owner aggregate remains in the separate Finish Plan surface.
Live anonymous reports retain every Flag and its evidence but receive zero prompts and no aggregate plan.
Repository samples expose one demonstrated Flag prompt, no aggregate prompt, their static Timeline, and no update-review action.

Prompt copy and Ready to verify controls now require an explicit owner action context containing the audit ID, report surface, and owner access state.
Curated samples, anonymous viewers, and non-owners never receive that context and cannot render lifecycle mutation controls.

## Main files

- `components/report/ReportWorkspaceSplitShell.tsx`, `ReportOutcomeBar.tsx`, `ReportExplorer.tsx`, `ReportExplorerDetail.tsx`, `FlagDetailPanel.tsx`, and `ScoreHistoryChart.tsx`
- `components/audit/AuditReport.tsx`, `LiveReportExplorer.tsx`, and `FixPromptBlock.tsx`
- `lib/report/explorer-model.ts`, `prompt-access.ts`, and `workspace-adapters.ts`
- Direct unit, component, adapter, progressive, and public journey tests for the changed behavior

## Proof

- Targeted ESLint passed for every changed report, audit-composition, and report-model file.
- `npx tsc --noEmit --pretty false` passed.
- The focused report suite passed 138 tests across 24 files.
- `npm run ui:drift-guard` passed.
- `npm run agent -- verify` passed all 13 affected commands, including typecheck, lint, app/API/component/audit/marketing/queue tests, brand guards, and UI drift.
- `npm run agent -- eval ui` passed the complete curated 7-Flag sample at 320, 375, 768, and 1280 pixels plus 200% reflow and reduced motion.
- The browser evaluation directly proves Launchpad identity in Agent, one Score/history region, completed Report selected, Timeline available, no duplicate Product report label, no horizontal overflow, and 44-pixel interactive targets.
- A focused Playwright assertion passed that traverses the curated sample and proves exactly one demonstrated Fix prompt is reachable, with no Ready to verify or update-review mutation controls.

## Integration needs

The shared visible copy should rename `REPORT_COPY.topFixes.title` from `Top fixes` to `What to fix next`; that copy module belongs to the concurrently owned homepage lane and was deliberately not edited here.
Root should rerun `node scripts/report-pane-proof.mjs` after all concurrent write lanes settle because the first standalone attempt began without a server and a later attempt was invalidated by continuous HMR rebuilds while the other lanes were writing.
The final credentialed owner, anonymous, shared, claim, update-review, receipt, MCP, and CLI matrix remains an integration/release responsibility.
No schema or public API was added by this lane.
