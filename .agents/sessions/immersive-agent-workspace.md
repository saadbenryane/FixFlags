# Immersive Agent Workspace + Homepage Rolling Chat

**Status:** complete  
**Board:** `immersive-agent-workspace`  
**Started:** 2026-08-16

## Condition

1. Report/share routes: no footer; Product identity + Working in Agent header; Preview-first active review with Report\|Preview on the Product pane; viewport-fill split; no scanning hero banner; no below-split context while scanning.
2. Homepage sample: finite five-beat value story using `buildFixFlagsScanMessages` + shared Working/transcript chrome; reduced-motion shows the final recommendation; CTA remains `/samples`.
3. Docs + design-system/product skills describe the immersive contract.

## Proof commands

```bash
npx vitest run components/report/__tests__ components/audit/__tests__/AuditReportProgressive.test.tsx components/marketing --reporter=dot
npm run validate:quick
npm run ui:drift-guard
```

Browser: scanning `/report/[id]` and homepage sample at 375 / 768 / 1280.

## Phases

- [x] Phase 0 claim
- [x] Phase 1 shell immersive
- [x] Phase 2 agent/product chrome
- [x] Phase 3 homepage rolling chat
- [x] Phase 4 docs/skills
- [x] Phase 5 verify close

## Result

The active review now defaults to live Product Preview on desktop and keeps Agent first on mobile.
The left pane identifies the Product, explains current customer-meaningful activity, curates grounded Flag announcements, and preserves conversation.
The right pane owns Product reality, evidence, and Report/Preview controls.
Completed reviews return to Report without restoring the marketing footer.

The homepage sample now tells one complete story: experience Product, notice an issue, show evidence, surface the Flag, and recommend the improvement.

## Verification

- `npm run validate:quick` passed.
- `npm run ui:drift-guard` passed.
- Focused living-review tests passed (34 workspace tests plus curated-activity and reduced-motion coverage).
- `npm run agent -- verify` passed all 11 affected commands.
- Real anonymous `example.com` scan passed browser review at 375, 768, and 1280 pixels.
- Browser evidence showed Preview selected while scanning, meaningful activity and observations, desktop/mobile captures, Inspect Flags when findings appeared, a curated transcript, no footer, and Report selected after completion.
