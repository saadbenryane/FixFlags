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

## Eval inventory

*(To be populated as evals are created.)*

### Suggested evals

- **Functional:** Full audit cycle on demo fixture (offline + rendered + flow)
- **Data:** Persist/retrieve roundtrip with known flags
- **Visual:** Brand color compliance, UI drift against design tokens
- **Accessibility:** Lighthouse a11y score, keyboard navigation smoke test
- **Content:** No banned phrases, no em dashes, no hardcoded copy
- **Voice:** Anti-slop scoring of marketing pages
- **Responsive:** Report page at 375px, 768px, 1280px
- **Regression:** Known sites produce expected flag counts

## Improvement workflow

1. Establish baseline (current eval result)
2. Make focused change
3. Re-run same eval
4. Compare results
5. Inspect real artifacts (not just pass/fail)
6. Retain change only when it improves the product without unacceptable regressions

Never optimize a fixture through case-specific production logic.
