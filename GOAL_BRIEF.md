# GOAL_BRIEF — Complete Agent-Led Report Workspace

## Execution status

**Local implementation: complete. Release proof: blocked on named external fixtures.**

P0 through P6 are implemented in the current working tree.
The focused suites, TypeScript, database checks, completeness audit, accuracy evaluation, production application build, worker build, and a real anonymous scan at 375, 768, and 1280 pixels passed.
A full local verification also completed 3,800 tests and a container build before Docker Desktop later developed an internal metadata I/O failure.

P7 is the only remaining package.
Follow the exact continuation and sign-off procedure in [`.agents/sessions/agent-workspace-completion.md`](.agents/sessions/agent-workspace-completion.md).
Do not reopen P0 through P6 unless a P7 journey produces evidence of a defect.

## Condition

Ship the approved Agent-led report workspace completely and honestly.
The left Agent accepts URLs, emits deterministic scan messages through the same UI channel as metered LLM conversation, and exposes History/New scan.
The right Report is public-safe; Timeline and prompts require authentication; private paid Canvas is evidence-grounded and versioned.

## Non-negotiable contracts

- Programmatic scan messages consume zero model tokens, are reconstructed from persisted facts, and never become chat rows or model turns.
- Logged-out users can read the progressive/completed report, confirmed Flags, screenshots, evidence, and programmatic Agent transcript.
- Logged-out responses omit prompts, Timeline/playback, private memory/history, Canvas, update review, export, and restricted sharing data.
- Authentication claims the report through `/post-login` and unlocks the existing workspace.
- Free/Pro/Studio monthly chat limits are 25K/500K/2M input-plus-output tokens with atomic reservation and provider-usage reconciliation.
- Agent toolbar is title-free: History immediately left of New scan; mobile tab remains Agent.
- New scan reuses `/api/checks`; no second scan pipeline.
- Canvas is paid, private, schema-driven, versioned, and source-referenced; generated code never executes.
- Product Graph remains unclaimed until independently shipped and verified.

## Packages and proof

| Package | Owner | Exclusive scope | Dependency | Proof |
|---|---|---|---|---|
| P0 contracts | primary | canonical report/product/design/security/pricing docs | none | drift review and docs guards |
| P1 access/usage/history | subagent A | access serialization, history service/API, billing/auth usage, Prisma migration, boundary tests | none | focused service/route/migration tests |
| P2 Agent messages | subagent B | AgentMessage contract, deterministic builder, scan copy, status response/tests | none | table-driven message and route tests |
| P3 Canvas domain | subagent C | Canvas schema/models/services/APIs/tests | none | schema/auth/version/service tests |
| P4 workspace | primary | Agent panel, transcript, composer modes, toolbar, History/New scan, locked Timeline, mobile, Product Spine re-anchor | P1/P2 | components and real browser flows |
| P5 Canvas renderer | Canvas owner | shared-primitives renderer and version UI | P3/P4 | component/browser/security tests |
| P6 streamline | message owner after P4 | shared composition and dead/duplicate/silent-catch removal | P2/P4 | typecheck, lint, import/build analysis |
| P7 release | primary | integration, docs reconciliation, full verification | all | agent verify, full verify, accuracy, UI, completeness, release proof |

P1, P2, and P3 may run concurrently because their write scopes are disjoint.
P4 begins after P1/P2 interfaces integrate.
P5 begins after P3.
P6 begins after P4.

## Acceptance matrix

- New scan: homepage and Agent share creation service; plus creates nothing until valid URL; errors and limits preserve the current report.
- Unified Agent: programmatic/model/user messages share one envelope and transcript; only model usage is metered; completion/auth refresh never duplicates messages.
- Truth: stable milestone/Flag IDs, monotonic polling, teaser/degraded/recovery/failure accuracy, no raw Timeline claims.
- Access: anonymous public evidence with server-side redaction; authenticated Free prompts/chat/Timeline; paid Canvas; cross-owner/shared/revoked boundaries enforced.
- History: anonymous current-session opaque references only; authenticated cursor history is ownership-scoped, ordered, Product-aware, and claim-safe.
- Canvas: grounded source refs, strict schema, immutable versions, safe renderer, explicit failures, no executable generated content.
- UI: 375/768/1280, dark, reduced motion, 200% reflow, keyboard/focus/live regions/44px targets, no overflow or scroll traps.

## Verification

Run focused tests at each package boundary, then:

1. `npm run ui:drift-guard`
2. `npm run completeness:audit`
3. `npm run accuracy:eval`
4. `npm run agent -- verify`
5. `npm run verify`
6. Manual logged-out, Free, Pro, and Studio report journeys.
7. `npm run verify:release` with designated credentials and production dogfood.

Missing release credentials are blockers, never skips.
