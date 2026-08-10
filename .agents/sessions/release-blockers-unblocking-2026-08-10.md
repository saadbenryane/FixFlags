# Release Blocker Unblocking Run — 2026-08-10

## Objective
Immediate analysis and DECIDE packets for the three primary release blockers identified in BOARD.md.

---

## Blocker 1: agent-p7-release-proof
**Status:** blocked
**Owner:** codex-root
**Dependency:** Operator-provided release credentials/fixtures (production URL, disposable DB consent, sandbox Free/Pro/Studio accounts, mailbox assertion, GitHub fixture) + Docker Desktop daemon metadata I/O failure recovery
**Classification:** operator-gated (external fixtures) + infra-gated (Docker Desktop)

**2-line recommendation + ETA:**
1) Secure production release URL, approve disposable database reset, and provide sandbox account credentials before 2026-08-14 EOD.
2) Repair Docker Desktop daemon metadata I/O failure to unblock final container build.
**Target ETA:** 2026-08-14 (Thursday)

**DECIDE packet (founder-facing):**
- **Context:** Credentialed release verification and production role journeys require external operator-provided fixtures; Docker Desktop metadata I/O prevents final container build.
- **Decision needed:** Approve disposable database reset consent and provide sandbox fixture credentials; confirm Docker recovery path.
- **Options:** (a) Use operator-provided disposable PostgreSQL URL and sandbox accounts, (b) Obtain trusted-publisher npm key with 2FA and push protected release tag, (c) Exclude Docker-only tests from release gates temporarily.
- **Recommendation:** Option (a) — consolidate all fixtures into single operator ticket; coordinate Docker fix in parallel.
- **Cost of waiting:** Blocked downstream customer access and revenue until resolved.
- **Owner action:** codex-root opens secure ticket for each external fixture, coordinates with operator, tracks DECIDE decisions in company scorecards.

---

## Blocker 2: cli-customer-onboarding
**Status:** blocked
**Owner:** codex-root
**Dependency:** Operator must rotate exposed npm publishing key, claim npm package with 2FA, configure trusted-publisher, and push protected release tag
**Classification:** operator-gated (infrastructure credentials)

**2-line recommendation + ETA:**
1) Rotate exposed key and configure trusted-publisher with protected tag workflows.
2) Push verified CLI build to protected tag with verification-evidence payload.
**Target ETA:** 2026-08-12 (Tuesday)

**DECIDE packet (founder-facing):**
- **Context:** CLI implementation complete but npm trusted-publisher setup and key-rotation steps remain operator-gated.
- **Decision needed:** Execute key rotation and trusted-publisher configuration; confirm release tag push.
- **Options:** (a) Rotate exposed key and configure trusted-publisher, (b) Skip external publishing and promote local build for testing only, (c) Waive CLI release for this cycle and rely on workspace internal CLI tooling.
- **Recommendation:** Option (a) — required for customer-facing CLI distribution.
- **Cost of waiting:** CLI unavailable to customers; release can proceed without CLI if alternative local tooling is accepted.
- **Owner action:** codex-root coordinates with operator for key rotation and push release; dashboard link: credentials → npm publish.

---

## Blocker 3: current-product-completion
**Status:** blocked
**Owner:** codex-root
**Dependency:** Operator-provided release URL, disposable database/reset consent, sandbox users, mailbox assertion, GitHub fixture, and container environment (same external fixtures as agent-p7 but for main product deployment)
**Classification:** operator-gated (external fixtures) + infra-gated (container environment)

**2-line recommendation + ETA:**
1) Provide production URL, disposable DB consent/reset, and sandbox Free/Pro/Studio accounts to enable credentialed release verification.
2) Close Docker Desktop metadata I/O failure with patch or alternative container orchestration.
**Target ETA:** 2026-08-14 (Thursday)

**DECIDE packet (founder-facing):**
- **Context:** Product completion blocked by operator-provided external credentials/fixtures identical to agent-p7 but for the main application deployment.
- **Decision needed:** Approve consolidated fixture provisioning for main product; confirm container environment readiness.
- **Options:** (a) Use operator-provided disposable database and GitHub fixtures, (b) Accept interim deployment without credentialed proof and document restrictions, (c) Leverage shared staging database with controlled access.
- **Recommendation:** Option (a) — consolidate three fixture requests into single operator ticket, prioritize Docker fix first, log decisions in .agents/company/ceo.md.
- **Cost of waiting:** Product release delayed; no downstream customer impact beyond timing.
- **Owner action:** codex-root consolidates fixture requests, prioritizes Docker recovery, logs decisions in CEO scorecard.

---

## Summary
All three release blockers share two common external dependencies: operator credentials/fixtures and Docker Desktop recovery. Consolidate fixture requests and coordinate operator timeline to unblock the release pipeline.

**copied from latest artifact**

unblock packet ready