# Evaluation Suites

*Quality evals for automated verification. Each eval defines a repeatable procedure and expected result.*

## Adding an eval

Each eval file should define:
- **Purpose:** What risk or quality dimension it covers
- **Fixture/dataset/reference:** What input it uses
- **Command or procedure:** How to run it
- **Expected result:** What constitutes passing
- **Scoring and threshold:** How results are scored, pass/fail threshold
- **Latest verified result:** Date and outcome of last run
- **Known weaknesses:** What the eval does not cover

## Executable inventory

| Area | Command | Behavior exercised |
|---|---|---|
| Functional audit | `npm run agent -- eval audit` | Offline baseline-to-fixed Flag → Fix regression fixture |
| Scan accuracy | `npm run agent -- eval accuracy` | Gold 0 false blockers, builder top-3, demo v1 repair, non-HTML regression |
| Report contract, responsive, accessibility | `npm run agent -- eval ui` | Detailed sample sections, identity, target size, overflow, and client errors at 375/768/1280 |
| Runtime recovery | `npm run agent -- eval recovery` | Live PostgreSQL query, Redis processing, retry recovery, and duplicate-job idempotency |
| CLI packaging | `npm run agent -- eval cli` | CLI tests, build, package contents, and install smoke |
| Billing | `npm run agent -- eval billing` | Entitlement and billing behavior tests |
| Prompt contract | `npm run agent -- eval prompts` | Prompt composition and provider contract tests |
| Knowledge | `npm run agent -- eval docs` | Canonical knowledge duplication guard |

The release bar is `npm run verify:release`. Missing credentials or infrastructure are failures, not skipped successes.

## Improvement workflow

1. Establish baseline (current eval result)
2. Make focused change
3. Re-run same eval
4. Compare results
5. Inspect real artifacts (not just pass/fail)
6. Retain change only when it improves the product without unacceptable regressions

Never optimize a fixture through case-specific production logic.
