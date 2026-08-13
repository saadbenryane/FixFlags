# Game On launch continuation

**State:** Local implementation and full local verification pass.
**Release state:** Blocked before destructive setup because the designated credentialed fixtures are absent.
**CLI state:** Registry `latest` is `1.0.4`; corrected local behavior is prepared as `1.0.5` and must be published through the trusted-publisher workflow after release proof.

## Proven locally

- Live anonymous access projects zero prompts; curated samples project one demonstrated prompt; authenticated owners receive eligible prompts.
- Complete Fix List and bounded one-to-three item Finish Plan come from one shared ranking pass.
- Critical chat, protected-share, and Stripe routes are thin service adapters.
- Railway deploy health uses `/api/health/ready`.
- Coverage is 71.01% statements, 65.09% branches, 71.60% functions, and 72.39% lines.
- `npm run agent -- verify`, `npm run verify`, recovery evaluation, UI evaluation, production build, and Docker image build pass.
- The final post-reconciliation `npm run agent -- verify` passed all 26 commands without changing source files.
- Public UI axe and responsive matrices pass; final sample screenshot lives at `/Users/saadbenryane/.codex/visualizations/2026/08/11/019ff153-d2d1-71c1-aa15-6d331b1d08c2/fixflags-sample-1280-final.png`.

## Required release inputs

Provision the variables reported by `node scripts/release-preflight.mjs` through approved environment channels.
They include the disposable release database and reset consent, release container environment, deployed smoke target, sandbox authentication and billing users, protected-share fixture, Watch/mailbox fixture, GitHub fixture, and authenticated API key.

## Continuation sequence

1. Ensure no other agent is editing the tree.
2. Export the designated release inputs without printing their values.
3. Run `npm run verify:release` with no skips.
4. Sign every row in `.agents/sessions/credentialed-journey-matrix.md` from generated evidence.
5. Deploy the verified web and worker revision, then require `/api/health/ready` to return no missing subsystem.
6. Rerun the queue-backed anonymous zero-prompt journey, claim, role billing, update review and Remember, protected share expiry/revoke, Watch email, GitHub Fix PR, authenticated MCP, and packaged CLI journeys.
7. Tag the exact release commit as `fixflags-cli-v1.0.5`, monitor the trusted-publisher workflow, clean-install the registry version, and dogfood check plus update review against production.
8. Update final production screenshots and mark the Game On goal complete only when every row passes.

## Current production mismatch

The 2026-08-11 production readiness endpoint was healthy, but the deployed homepage still rendered “Review my product.”
The verified local contract renders “Review my site,” so the production anonymous smoke timed out before submission rather than weakening the selector.
