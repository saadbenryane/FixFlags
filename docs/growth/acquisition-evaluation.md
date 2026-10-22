# Acquisition evaluation

This procedure evaluates technical discovery and the customer path without treating
synthetic agents as evidence of customer demand or willingness to pay. Product
execution, authorization and release decisions remain with their existing owners.

## Separate customer experience from verification

The customer evaluator receives a realistic website-owner task and the public app
URL. It does not read source, expected results, database records or the verifier's
notes. It uses an independent browser context and ordinary visible controls.

The verification evaluator checks the exact same owned evaluation, with authorized
creator access, against retained execution records and implementation contracts.
It distinguishes complete processing, incomplete coverage, observed problems,
recorded fix attempts and fresh independent recovery. It does not close Flags or
infer recovery from a copied prompt, deployment, or disappearance in a later scan.

Use FixFlags' own public website for live self-analysis. Use controlled local
websites for known broken and healthy cases, unsuccessful fixes and recurrence.
Do not repeatedly scan a live website to manufacture a favorable result. Each
live evaluation begins with at most one initial analysis. Account creation,
monitoring and verification steps use dedicated test ownership, never an existing
customer account. Keep inability to cross an authentication or capability boundary
as an explicit incomplete step.

Retain timestamps, route/status observations, viewport and screenshots in the
ignored `test-results/growth/` directory. Creator storage state is private, mode
0600, never included in source, reports or terminal output. Share access only with
the verifier for that exact owned evaluation. Do not record another customer's
content. Close evaluation browser contexts when the observation is complete.

For every scenario report the task, observed outcome, evidence, limitations and
owner of any defect. The acquiring customer sees no implementation details. The
verifier independently distinguishes current workspace behavior from the deployed
revision. A synthetic success establishes only the exercised behavior.

## Technical public discovery

```sh
npm run growth:verify-live
npm run growth:verify-live -- --json
```

This read-only command checks the current sitemap rather than historical sample
routes or retired copy assumptions. It checks public responses, canonical metadata,
indexing restrictions, H1 and title presence, social previews, parseable structured
data and named search-crawler rules. Conditional issue research is not required.
It rejects private, foreign-origin and parameterized sitemap destinations before
fetching. Requests are bounded and redirects are not followed. A loopback fixture
may be selected with `SEO_VERIFY_ORIGIN`; other unrelated hosts are rejected.

A failed check exits nonzero. Transport failures are unavailable evidence, not proof
that a page returned an error. Passing checks do not establish indexing, rankings,
AI citations, browser performance, actual crawler access, conversion or product
reliability. Google Search Console, Bing Webmaster Tools and verified request logs
remain the appropriate sources for their respective outcomes.

## Free-tool measurement

The existing consent-aware analytics pipeline emits `tool_interaction` with:

| Field | Values |
| --- | --- |
| `tool` | `meta-preview`, `placeholder-detector` |
| `outcome` | `submitted`, `succeeded`, `api_error`, `application_error`, `network_error`, `response_error` |
| `journey_id` | Optional opaque, consented browser-tab journey identifier |

Each valid submission emits one submitted event and one terminal outcome after its
request completes. A pending request has no terminal result yet. Blank input is
validation, not a submission. A 200 response with a domain error is an application
failure. Failed retrieval must not display a clean inspection. Submitted URLs,
returned content, matches and error text never enter these event parameters.
Without consent, the events and journey storage remain absent.

Full analysis retains its existing `started_audit` and source attribution. Public
entry sources retain their consented journey independently of visual layout.
Dashboard and report sources do not acquire a public journey from a query marker.
Do not
count the tool's success as a Site activation or a verified repair. Compare tool
submissions, terminal outcomes, attributed full analyses and exact claim receipts;
missing consent or telemetry remains missing evidence. Do not divide event counts
into a visitor-level conversion rate or assume unique human users.

## Operational measurement

`loadSiteFirstValueFunnel` reports `completedWithoutReceipt` separately from
`stillRunning`. A completed audit without its best-effort completion receipt is a
telemetry gap. It remains outside receipt-based completion counts. The compatibility
name `firstUsefulResult` does not establish usefulness.

The existing read-only reporting inspector needs the configured FixFlags GA4 and
Search Console properties and authorized reporting credentials. Missing credentials
are unavailable data. Do not substitute saved snapshots, synthetic evaluations or
zeros for a fresh reporting pull. Seven-day Site-value reports require a mature
observation window; an immediate self-test cannot establish retained usage.

## Initial execution and remaining gates

The first evaluation on 2026-10-20 exercised anonymous self-analysis, evidence
inspection, authentication boundaries and public discovery. Its private observations
belong under ignored artifacts, not in public research or customer proof. Reliability
and presentation defects are handed to the product-foundation owner. This growth
slice adds tool failure handling, acquisition telemetry and trustworthy technical
verification without changing product execution or opening paid/MCP access.

Next, repeat the same tasks against the integrated candidate using controlled
healthy, broken, failed-fix and recurrence cases. Finish owned-account save, fix,
independent verification and naturally scheduled monitoring only when those paths
are available and authorized in the candidate's test environment. Their unexecuted
steps remain unproven. Expand content and distribution using supported capabilities
and measured activation. The existing product readiness and MCP discovery gates
still apply; this procedure cannot open them.
