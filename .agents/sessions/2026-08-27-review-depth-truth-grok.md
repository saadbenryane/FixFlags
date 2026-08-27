# review-depth-truth

Date: 2026-08-27
Owner: grok
Branch: main

## Outcome

Public Product Review now has one contract (`reviewDepth`), one Flag identity (unique paths), and one honest coverage sentence. The 6-URL crawler is no longer taught. Persist writes the collapsed union after each reviewed page. Missing PageSpeed on a reviewed page is PARTIAL.

## Proof

- `npm run agent -- verify` passed (affected validation).
- Migrations applied locally: `20260827120000_review_depth_open_check` (and pending `20260826233000_drop_unused_experiment_rum` already on main).
- Live depth-2 review: `http://localhost:3000/report/cmtas0uwf0000gpr8o6p22xcp` against `https://saadbenryane.com`
  - 18 pages fully reviewed, 17 open-checks, 20 Flags
  - `reportCompleteness: PARTIAL` (PageSpeed missing on reviewed pages)
  - collapsed Flag identity: `On 13 pages` / `On 3 pages` / `On Home` / `On /path`
  - coverage: "Reviewed this page and 17 linked pages. Opened 17 public links. Review was partial."
- Browser 375 / 768 / 1280: coverage sentence, path labels, Partial report banner, no JourneyBar, no page chips. Artifacts: `.agents/artifacts/review-depth-truth/report-{375,768,1280}.png`

Open-check HEAD-fail+GET-ok, GET 404, and URL identity collapse remain unit-proven (`lib/audit/__tests__/open-check.test.ts`, url-identity tests). Soft-404 and auth-required were not re-run as a separate live site; they stay in those tests.

## Do not

Logged-in review on the user machine, CLI/MCP unpark, crawler UI, Deep Review as a depth SKU.
