# Completeness review rules

Use this file for judgment-heavy review. Deterministic drift belongs in `scripts/completeness-audit.mjs`.

## Product and persistence

- A signed-in hostname resolves to one internal Product by `canonicalHost`. `isManaged` controls Studio quota and UI only.
- All Product Intelligence mutations use the revisioned mutation helper. Contract edits, feedback, claims, heuristics, and verified learning must merge current state.
- Claims keep their cookie until ownership, Product attachment, Contract merge, and audit assignment commit together.
- Manual re-checks stay free. Only WATCH children produce scheduled regression delivery.

## Sharing and access

- Protected links use versioned asynchronous hashes and signed HttpOnly grants. Opening a link never changes `Audit.isPublic`.
- Every protected request re-checks link version, revocation, expiry, audit identity, and owner entitlement.
- View limits are consumed only when a new grant is issued. Metadata and social images remain generic for protected links.

## Report and Finish Plan

- Report hierarchy and order live only in [`knowledge/report-contract.md`](../../../../knowledge/report-contract.md). Review that source instead of copying its sequence here.
- Sticky destinations and conditional DOM sections use the same predicates.
- One `buildFinishPlan` result owns cards, count, prompt, MCP, CLI, REST, and re-check output. All-prompts export is separate.
- Anonymous reports have only the value strip and Sample Fix CTA. Never add signup buttons to each Flag or Finish Plan card.

## Runtime and release

- Missing PostgreSQL, Redis, migrations, required environment, Chromium, worker readiness, or configured email must be visible through doctor/health state.
- Exercise loading, empty, partial, failed, owner, anonymous, shared, watched, and re-check states at 375, 768, and 1280 pixels.
- Verify keyboard focus, dialog/sheet semantics, reduced motion, horizontal sticky navigation, error recovery, and queue crash recovery.
- Run three consecutive unit suites when suite-order instability was observed.
- Build the Docker image when package or container inputs change. Do not infer production smoke success without credentials and a deployed target.
