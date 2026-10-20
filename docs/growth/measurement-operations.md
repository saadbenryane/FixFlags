---
status: supporting
authority: operations
reviewed_at: 2026-10-20
supersedes: []
---

# Growth measurement operations

Use fresh, scoped observations with explicit windows. Missing credentials, reports,
observations or mature follow-up are unavailable evidence. A recorded zero is
appropriate only for an observed absence within an available source.

## Configuration and reporting readiness

```sh
node --import tsx scripts/growth/inspect-growth-readiness.ts 2026-09-15 2026-10-12
node --import tsx scripts/growth/inspect-growth-readiness.ts 2026-09-15 2026-10-12 --live
```

The default checks the actual process environment without contacting a provider.
It checks each known FixFlags GA4 property, Search Console property, credential
presence, browser measurement configuration and operational database presence
separately. It never prints configured values, credential paths or exceptions.
A present credential is unverified. Browser environment presence does not prove
that the deployed bundle was built with it. A missing prerequisite does not
become a traffic, signup or conversion zero.

`--live` reuses `lib/growth/reporting-access.ts` with the supplied inclusive
calendar window. It requests only the existing FixFlags aggregate GA4 and
finalized Search Console web-search reports with read-only scopes. Arbitrary
properties are refused. It makes no GA configuration changes and writes no
database or artifact. Partial provider reports remain partial; a successful
request with no metrics does not establish zero activity. The report retains
source, window, extraction time and existing provider limitations. Nonzero exit
means a requested live report could not be fully accessed.

The known production measurement targets are documented in
[public-site-measurement.md](public-site-measurement.md). Reports use each source's
calendar conventions. Consent, reporting lag, sampling, thresholds, grouped-row
loss and hidden search queries limit interpretation. The browser journey is an
opaque consented tab key, not a person or GA session. Search impressions are not
an indexing census, and position is not a live ranking. Do not combine these
sources into a conversion rate without the existing validated join.

Readiness leaves operational cohorts explicitly not requested. Reuse the existing
aggregate inspector with an authorized local loopback PostgreSQL environment:

```sh
node --import tsx scripts/growth/inspect-customer-value.ts 30 acquisition
node --import tsx scripts/growth/inspect-customer-value.ts 30 sites
node --import tsx scripts/growth/inspect-customer-value.ts 60 sites28
node --import tsx scripts/growth/inspect-customer-value.ts 30 cycles
```

The existing queries retain read-only transactions, bounded source reads, exact
claim receipts and repair lineage. `sites` preserves the seven-day follow-up
default; `sites28` selects a complete 28-day follow-up. The first numeric argument
is the claim lookback window, not the follow-up duration. For example, a 60-day
lookback gives older claims an opportunity to mature for 28 days. Immature Sites
are counted separately and excluded from every outcome denominator. Reports
record their selected `followupDays`; only compare matching follow-up windows.
These counts remain observed operational evidence, not human retention or revenue. Keep their source
window and limitations beside the output. This command cannot establish cash
received, public research permission or total acquisition coverage. Do not export
raw customer rows or copy a production credential into a local file.

## Recorded public AI answers

```sh
node --import tsx scripts/growth/evaluate-ai-visibility.ts --prompts
node --import tsx scripts/growth/evaluate-ai-visibility.ts
node --import tsx scripts/growth/evaluate-ai-visibility.ts .data/ai-visibility/observations.json
```

The fixed versioned set contains 24 branded, unbranded buying, comparison and
negative/out-of-scope prompts. Record the exact prompt in a public model interface
and retain platform, model/version and UTC observation timestamp. Never insert
customer domains, prompts, private findings or account data. The tool does not
contact models, fetch citations or make paid calls. A run with no file reports
unavailable observations, not invented responses or zero brand visibility.

Raw JSON must be a user-supplied ignored local file. The CLI checks Git ignore
status, resolves symlinks and rejects files outside the repository or over 10 MB.
It writes nothing. Do not commit the input or place it in growth artifacts. A
minimal observation shape is:

```json
{
  "publicBrandAnswersOnly": true,
  "observations": [
    {
      "promptId": "branded-01",
      "platform": "chatgpt",
      "model": "record-the-observed-model-version",
      "observedAt": "2026-10-20T12:00:00Z",
      "answer": "Replace with an actually observed public brand answer.",
      "citationUrls": [],
      "review": { "offer": "unreviewed", "mcp": "unreviewed", "capabilities": "unreviewed" }
    }
  ]
}
```

This shape is instructional and is not evidence. Platforms are `chatgpt`,
`google-ai`, `perplexity`, `claude`, `copilot` and `other`. Model labels are required
on inputs but withheld from output, along with answers and URLs. Prompt IDs must
come from `--prompts`. Exact repeated prompt/platform/model/timestamp observations
are rejected. Repeated observations on different dates or models increase the
observation count, never the prompt coverage count. Unknown fields and malformed
or private citation syntax fail without reflecting their content. Citation URLs
must use HTTPS with a DNS hostname, without credentials, query, fragment, custom
port or private FixFlags route. This syntax validation does not verify that the
cited page is public, reachable or supports the answer.

Output contains aggregate mention and citation counts, aggregate observation
window/platforms and finite per-prompt coverage statuses. An observed answer
without the literal FixFlags brand name counts as observed absence. A missing
prompt stays unavailable. Citation counts describe recorded citations; no raw
citation or answer is serialized. Input truthfulness remains the recorder's
responsibility, and the public-only declaration is not automatic privacy review.

Manual factual review remains required. Review `offer`, `mcp` and `capabilities`
against canonical source files at the observation date, then label each
`supported`, `contradicted`, `not-addressed` or `unreviewed`. These are supplied
reviewer judgments, kept separate from observable literal counts. The report
includes current workspace public-offer copy and MCP discovery state by importing
the canonical modules. It does not duplicate pricing numbers or reinterpret a
withheld MCP discovery gate as live external-client availability. Use
`lib/billing/beta-policy.ts`, `lib/marketing/copy/plans.ts`,
`lib/marketing/copy/public-offer.ts`, `lib/mcp/discoverability.ts`,
`lib/mcp/access.ts` and `lib/docs/mcp-tool-reference.ts`. Current workspace state
is neither historical source evidence nor proof of the deployed revision.

Use matched prompt sets, platform/model versions and comparable windows when
comparing runs. Repeated observations do not prove independent demand, market
share, causal ranking improvement or that any website change caused a mention.
Technical discovery checks in [acquisition-evaluation.md](acquisition-evaluation.md)
remain separate from indexing, AI citations, customer activation and retained use.

## Search ownership and IndexNow

Set `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` only to tokens issued
for the actual FixFlags account. Metadata supports both. A rendered token is not
proof that an account has accepted ownership or that URLs were indexed.

`INDEXNOW_KEY` is a public verification key, 8 to 128 letters, digits or hyphens.
When configured, `/indexnow-key.txt` serves it as plain text. An unset key returns
404. Deploy the route and matching key before requesting submission:

```sh
npm run growth:indexnow -- --paths=/guides,/guides/checking-after-publishing
npm run growth:indexnow -- --paths=/guides,/guides/checking-after-publishing --submit
```

The first command prepares only registered public URLs and sends nothing. The
explicit `--submit` mode verifies the deployed key, then checks every submitted
page for an HTTP 200 HTML response, its production self-canonical, and absence of
noindex. It fails before posting if any preflight is unavailable or wrong. URLs
with query strings, fragments or unregistered/private paths are refused. Redirects
are not followed. Requests use fixed provider and production origins, bounded
bodies and timeouts. A provider 200 means receipt, 202 means pending key validation;
neither establishes indexing, ranking, citations, or traffic. No submission has
been made as part of this implementation.
