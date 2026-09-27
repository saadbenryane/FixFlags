# Scan accuracy dogfood — 2026-09-26

## Scope

Local production-path dogfood, rendered browser accuracy, AI triage grounding, worker reliability, and credential-free integration verification. Existing Site connections, Shopify, MCP, and launch work was preserved.

## Reproduced defects and fixes

- The live browser corpus initially failed three expectations. The portfolio homepage CTA had legitimately changed to `Start a project`. A terminal article CTA was incorrectly reported as a hidden primary CTA, closed mega-menu links were measured as deep page CTAs, and component demo controls were treated as product conversion actions.
- Layout checks now respect deterministic page purpose; responsive menus and footers are excluded from CTA selection; repeated rendered code-example controls positively identify component documentation.
- Audit `cmuioozqi0001on09blt1m23g` completed after retry but exposed the larger defect: 20 persisted rows included 4 AI Flags, with two unsupported `CRITICAL` and one unsupported `IMPORTANT` restatement of deterministic `POLISH` facts. The customer board showed 4 Flags.
- Triage now receives page purpose in request-specific context. Placeholder triage cannot add AI Flags. Deterministic theme ownership now covers vague CTA labels, privacy/contact wording variants, and internal navigation, while triage deduplication retains the model's evidence for matching.
- Fresh audit `cmuiowmwm0006ony6p4jqq76b` completed with 17 deterministic rows, 0 AI rows, 0 `CRITICAL` rows, and 1 customer-facing board Flag. Known false high-severity findings fell from 3 to 0.
- A stale worker process from 2026-09-24 was still emitting `browserOk: false` heartbeats and consuming jobs. After stopping exact PID `52517`, `/api/health/browser` reported one ready worker. Fresh audit `cmuip00re000bony62lsnyfym` then completed on its first attempt with no failure code and no AI Flags.

## Integration evidence

- Route contract guard: 105 routes passed.
- Focused Google connection matching, MCP OAuth/manifest, Railway deploy, and Shopify auth/callback/session/token/webhook tests: 22 files, 66 tests passed.
- Shopify fixture produced confirmed GREEN `checkout_reached` and RED `add_to_cart_noop` paths with captured step evidence.
- Audit capability matrix: 201 registered deterministic checks, 48 capabilities live, 0 partial, 0 planned.
- Standalone MCP quality gate failed: 20 registrations versus 19 catalog entries, duplicate `getFlag`, and seven Site tool keys missing from the manifest. This overlaps the active Site/MCP launch scope and was not rewritten here.
- No local live credentials were configured for Google, Shopify, GitHub, Railway, or PageSpeed, so external OAuth/install/webhook journeys were not claimed.

## Verification

- `npm run accuracy:eval` — 16 fixtures, gold high-severity false positives 0, failures 0.
- `npm run accuracy:browser` — 14 rendered targets, failures 0.
- Focused scan/prompt tests — 345 passed.
- Finish Plan/report/pipeline focused tests — 326 passed.
- `npm run demo:audit:offline` — baseline 13 Flags, fixed v1 0.
- `npm run completeness:audit` — passed.
- `npm run agent -- verify` — passed all 12 selected commands; log `.agent-runs/2026-09-26T18-02-12-710Z-help-catalog-guard.log`.

## Remaining readiness gaps

Full launch readiness is not claimed. `/api/health/ready` still reports missing PageSpeed, billing, email, and Product Watch configuration. Live external integration proof requires the designated credentials and production accounts.
