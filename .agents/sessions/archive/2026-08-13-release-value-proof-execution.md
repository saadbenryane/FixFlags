# Release and value-proof execution

Date: 2026-08-13

Verdict: PARTIAL

## Continuous production dogfood

A fresh anonymous production Review of `https://fixflags.com` completed as report `cmsruffh1000bqa20cuqjsyon` with score 80, FULL evidence capture, and ten persisted Flags.
Its raw verdict claimed the primary mobile call to action was not visible.
That claim was unsupported by every persisted Flag and contradicted by the Review's own 375 × 812 screenshot, where both header and hero actions were visible.
The independent rendered probe measured `Review my site` at 345px in an 812px viewport and emitted no `cta-below-fold-mobile` Flag.

The candidate now anchors verdicts to the highest-priority Flag that survives validation and deduplication.
The exact failure is a deterministic regression test and `fixflags.com` is part of the maintained rendered-browser accuracy corpus.
Focused verdict and false-positive tests passed, TypeScript passed, and the live rendered probe passed.

This improves judgment integrity but does not change the release verdict.
The deployed site still runs `350d595`; the corrected candidate remains local until the credentialed release process passes.

## Candidate

The release candidate now measures the durable customer-value funnel as Recommended → Accepted → Attempted → Verified → Outcome.
Copying a prompt records acceptance without creating an attempt.
Only an explicit implemented-change declaration creates or updates an Improvement Attempt.
Declined recommendations persist one of seven judgment reasons: wrong, already known, low impact, poor timing, too costly, weak recommendation, or misunderstood Product context.

The internal operating readout derives funnel counts, verification outcomes, rejection reasons, cost per verified improvement, verified meaningful improvements per active Product, and four time-to-value intervals from Product, Review, Improvement, Attempt, and run-cost records.
Feedback remains supporting evidence rather than the primary value signal.

## Verification

- Focused lifecycle, rejection, metrics, MCP, route, and component verification: 107 tests passed.
- Full affected gate: 25 commands passed.
- Full repository gate: 4,423 tests passed and 3 skipped; coverage, offline accuracy, CLI 1.0.5 packaging, application build, and worker build passed.
- Prisma migration applied to the disposable local development database; migration status and drift passed.
- Release-candidate Docker image built successfully as `fixflags:release-candidate`.
- Existing deployed production smoke against `https://fixflags.com` passed readiness, Chromium and R2, live AI credentials, and 84 route boundaries.
- Production still reports commit `350d595`, so this candidate is not yet deployed.

## Release blocker

The mandatory release preflight remains blocked because all 28 designated release inputs are absent from the execution environment.
These include the reset-authorized disposable release database, container environment file, smoke target assignment, role and billing accounts, WebAuthn and backup-code fixtures, protected-sharing fixture, Watch mailbox fixture, GitHub fixture, and FixFlags API key.

The production service has its normal runtime dependencies, and GitHub plus Railway production linkage are available.
Those are not substitutes for the destructive disposable-database consent or the signed credentialed journey matrix.
No push, deployment, CLI tag, or npm publication was performed.

The release verdict remains PARTIAL until `npm run verify:release` and every credentialed matrix row pass without skips on the deployed candidate, followed by FixFlags-on-FixFlags and public CLI 1.0.5 verification.
