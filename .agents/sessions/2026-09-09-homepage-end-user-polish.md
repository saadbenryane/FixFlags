# Homepage end-user polish

Owner: codex-design. Main. Owner authorized a design sweep and implementation. Existing shared working-tree changes preserved; another session committed the first implementation batch in 1389f98d during this run. Later refinements remain in the working tree. No deployment performed by this session.

## Plan and implementation

1. Homepage entry: smaller 14px CTA, one “No credit card required” reassurance; existing submission component retained.
2. Board preview: full-frame screenshots instead of shallow crops; wide preview requests 720px imagery. Flag links wrap onto a separate row with 44px targets. Corrected example total to four Flags.
3. Workflow and evidence: scroll position selects Check, Flag, Fix, Verify, with aria-current and forward/backward regression coverage. Evidence stacks at readable widths and stays alongside desktop steps. Dialog buttons have touch targets; navigating to the workflow closes the dialog without restoring focus to the card.
4. Outcome and watch sections: URL-first inferred-understanding copy; solid non-overlapping watch cards. Illustrative status retained.
5. Site mobile header: show the hostname instead of duplicating the overall attention label. Shared board media/header refinements also apply to the live Site.

## Evidence and limits

In-app browser localhost review: 375, 768 and 1280px; no horizontal document overflow at these checks. Visually inspected homepage, board, evidence dialog and watch section. Opened Conversion; checked dialog dismissal and workflow link. Initial browser timeouts were resolved by closing the secondary sign-in tab and applying the viewport to the active review tab.

Authenticated /dashboard redirected to /sign-in?next=%2Fdashboard. A complete signed-in dashboard/report walkthrough remains unverified. No claims of production deployment, end-to-end scan completion, or full accessibility compliance.

Screenshots: /Users/saadbenryane/.codex/visualizations/2026/09/09/01a083b1-c85b-7381-9cdd-250daf8534a7/design-review.md

Validation: typecheck passed; focused homepage and BoardCard tests passed (17); focused ESLint passed; brand hex guard and image local-patterns guard passed. npm run agent -- verify failed on repository lint: generated prototypes/fixflags-board/dist assets and scripts/shopify-fixture.ts, plus an existing unused BoardCard status binding that this pass fixed. UI drift guard flags existing app/new, ShopifyWorkspace and SiteBoard conventions. Artwork guard expects a retired LandingHowItWorksSection asset. These unrelated failures were preserved and prevent claiming a fully green repository.

Heartbeat packet: /tmp/fixflags-design-heartbeat.json, generatedAt 2026-09-09T01:15:07.690Z, ok=true. This is a local implementation review, not release proof.
