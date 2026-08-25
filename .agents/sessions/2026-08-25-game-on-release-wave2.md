# Game On release integrity, Wave 2

## Verdict

The local release contract is implemented and its focused proof passes.
The release itself remains `NOT MET` because no clean candidate SHA, external credentials, GitHub checks, Railway deployment, npm publication, production dogfood, or promotion receipt was created in this session.

## Implemented

- Release-environment stages use `RELEASE_ENV_URL` and `RELEASE_ENV_API_KEY`.
- Production stages use `PRODUCTION_URL` and `PRODUCTION_API_KEY`.
- Production command environments strip the release fixture manifest, release credentials, release database identity, and hydrated fixture identities.
- Final receipts hash API-key identities and reject a shared release and production credential without serializing either key.
- Fixture binding attests `/api/health` against the full candidate SHA before fixture provisioning can run.
- Production smoke requires a clean canonical production origin and exact full-SHA health evidence.
- Deployment evidence requires every paginated GitHub check to be successful, then requires successful Railway web and worker transitions after the latest CI completion on the exact SHA.
- Stable CLI publishing now targets `candidate`.
- Registry proof is locked to `fixflags@1.0.5`, the `candidate` tag, the package `gitHead`, a clean install, and the production CLI journey.
- The single promotion workflow checks out the supplied candidate SHA, revalidates the immutable candidate, moves that exact version to `latest`, and uploads a versioned promotion receipt.
- The duplicate latest-dist-tag workflow was removed.

The runtime-release skill kept remote readiness, web and worker attestation, packaged CLI proof, and operator-only actions explicit.
The completeness skill kept missing external evidence as a blocker instead of a skip or local PASS.

## Files

- `.github/workflows/publish-cli.yml`
- `.github/workflows/promote-latest.yml`
- `.github/workflows/update-latest-dist-tag.yml` removed
- `scripts/release-preflight.mjs` and its test
- `scripts/release-receipts.mjs` and its test
- `scripts/release-revision-attestation.mjs` and its test
- `scripts/release-deployment-attestation.mjs` and its test
- `scripts/release-smoke.mjs`
- `scripts/verify-cli-registry.mjs` and its test
- `scripts/cli-promotion-receipt.mjs` and its test
- `scripts/release-workflow-contract.test.mjs`
- `scripts/provision-release-fixtures.ts`
- `scripts/verify-production-dogfood.mjs`
- `scripts/agent-release-continuity.mjs`
- `scripts/route-boundary-smoke.test.mjs`
- `fixflags-cli/package.json`
- `package.json`
- `DEVELOPMENT.md`
- `docs/cli-release.md`

## Proof

- `npm run test:scripts`: PASS, 87 tests.
- Focused release tests: PASS, 41 tests.
- Focused ESLint for every changed release script and test: PASS.
- `npx tsc --noEmit --incremental false`: PASS on the shared integration tree.
- `git diff --check` for the release lane: PASS.
- `npm run agent -- verify --dry-run`: PASS, selected the 27-command full validation plan because shared validation configuration changed.
- `npm run agent:release-continuity -- --json`: WARN in plan mode because `PRODUCTION_URL` is unavailable; four local or credentialed checks remain planned and cloud smoke is explicitly skipped in non-strict planning only.

`npx prettier --check` was inspected but is not a repository gate for these no-semicolon scripts.
It reported style warnings across existing and changed release files, while ESLint and `git diff --check` passed.

## Operator gates

1. Finish all lanes, create one clean immutable candidate SHA, and obtain green required GitHub checks for that SHA.
2. Provide the disposable release database, reset consent, mode-600 container and fixture files, release-environment origin and credential, and the credentialed journey inputs.
3. Enable Railway Wait for CI for both web and worker.
4. Run fixture binding only after the release environment health endpoint reports the exact candidate SHA.
5. Provide the distinct production origin and API key, Railway and GitHub access, and the production dogfood fixture IDs.
6. Confirm post-CI Railway success for web and worker and exact-SHA `/api/health` evidence.
7. Configure npm trusted publishing and publish `fixflags@1.0.5` to `candidate` from the matching `fixflags-cli-v1.0.5` tag.
8. Run the registry, packaged CLI, MCP parity, production `IMPROVED`, and honest `INCONCLUSIVE` proofs.
9. Dispatch `promote-latest.yml` with version `1.0.5` and the full candidate SHA, then retain the uploaded promotion receipt with the final signed matrix.

No external publish, deploy, Railway setting, credential, database, or promotion action was performed.
