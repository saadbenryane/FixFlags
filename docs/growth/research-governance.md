---
status: supporting
authority: operations
reviewed_at: 2026-10-13
supersedes: []
---

# Public research boundary

The growth graph contains customer-derived observations. Audit completion,
`isPublic`, a `SEED` source, removing `www`, and a large sample do not establish
permission to republish those observations as research. Private Site memory and
connected data remain governed by the customer context.

## Reviewed release

Public issue readers use one existing `GrowthArtifact` record:
`path = research/public-issues/v1`,
`kind = approved-public-issue-research-v1`. They never fall back to graph Issue
copy, hostname examples, technology joins, counters, or legacy benchmark rows.
The index, sitemap, related links, preview counts, and detail pages use the same
validated release. A missing, invalid, future-reviewed, or expired release yields
no public issue entries. The existing library empty state remains available.

`lib/graph/public-research.ts` owns the exact schema. A release records its
observation window, total distinct sampled sites, methodology, limitations,
review and expiry dates, and private references to source evidence, permitted
use, and public-copy review. References are withheld from public models. Each
entry records the registered check version, affected distinct sites, total
observations, and optional framework cells. An observation is neither a site nor
a verified fix. These counts do not establish population prevalence, builder
quality, or causation.

At least 20 distinct sites are required for each published issue and each
framework cell. Small cells must be omitted, not pooled into a revealing label.
Framework counts cannot exceed affected sites. Counts cannot exceed the sample,
and occurrences cannot be fewer than affected sites. Identifiable examples,
audit IDs, unknown payload fields, page-scoped check IDs, duplicate checks,
unsupported check versions, and executable markup are rejected.

Schema validation verifies structure and arithmetic. It cannot prove permission,
anonymity, source authenticity, or that free-form copy contains no customer
details. A real reviewer must inspect the referenced evidence and the complete
public payload before approving it. Approval references are attestations to
that review, not an automatic consent mechanism. A minimum sample alone does
not guarantee privacy. Do not label a dataset approved to bypass this boundary.

## Owner permission

Site settings now contain an optional website-quality research checkbox. It is
off by default and applies prospectively to new check findings and independently
verified fix outcomes. It excludes domain/URL disclosure, screenshots, page
content, prompts, account details and connected analytics/search data. It is
independent of analytics cookies, Google OAuth, schedules and paid plans.

The owner-only `GET/PATCH /api/sites/[siteId]/research-consent` resolves the
existing tenant authority and rechecks the active Project owner. Grants and
withdrawals are append-only `public_research_consent` entries in private
`SiteLifecycleEvent` history, with policy version, actor, timestamp and a hash of
the Site origin and base path (excluding query strings and fragments). Consent is not a browser analytics event and is never inferred
from tracking consent. No new table or migration is required. Project row locks
serialize writes; repeat saves do not create new grants. An opt-in requires the
current wording version. Withdrawal remains available without agreeing to a new
version. A current owner or Site-address mismatch makes a prior grant ineligible.
Enabling permission for the changed context creates a fresh grant. Bump the
policy version whenever the permitted scope or consent wording changes meaning.

Permission receipts follow private Site-history retention and deletion rules.
The new event stores no URL, page content, credentials, visitor identifier or
connected-provider payload. Site deletion or account/ownership changes make its
sources ineligible regardless of retained receipt history.

## Private source manifest

A customer-derived public release also requires an existing `GrowthArtifact`
with `path = research/public-issues/v1/permissions` and
`kind = approved-private-research-permissions-v1`. Its exact schema lives in
`lib/growth/research-permissions.ts`: version, the matching release evidence
reference, and a bounded array of `{ projectId, grantId, auditId }` sources.
This manifest stays private and must never be committed as customer data or
included in public models. Keep it in existing authorized operator storage.

Every public read checks that the source Project exists and is not deleted,
its current owner and Site address match the grant, its latest consent is enabled,
and the manifest names that exact grant. Each completed source audit must belong
to that Site and owner, remain within its origin and base path, start after consent, and complete
within the reviewed observation window. Distinct source hostnames must match the
released sample size. Missing, stale, revoked, regranted, transferred, off-site,
pre-consent or deleted sources withhold the whole release until it is rebuilt and
reviewed. Re-enabling consent cannot restore an old release automatically.

Issue counts are checked against distinct eligible deterministic Flag IDs and
affected hostnames, with confidence at least 0.8. Page-scoped identities contribute
to their canonical base check. AI interpretations are excluded. Connected Search
module findings are withheld under this permission scope until evaluator-level
provenance can distinguish them from connected-provider data. Framework cells
must match confident, versioned technology observations from the affected source
audits, derived no later than review. Current hostname-level technology state
cannot substitute for those observations.

These checks establish source membership and count consistency, not detector
accuracy, original evaluator-version comparability, or privacy of free-form
copy. Human evidence, source-version and privacy review remain required.
Previously served external copies of anonymous aggregates cannot be
recalled. New FixFlags requests stop serving a release once its source grant is
withdrawn; request-time rendering prevents a static cached page from bypassing
that check.

## Preparing evidence

Prefer a deliberately authorized research cohort over opportunistic reuse of
customer data. Define permitted collection and publication, observation dates,
check coverage and versions, distinct-site identity, retention, withdrawal, and
sampling limitations before preparing aggregates. Keep private evidence in its
existing authorized storage. Do not put identifiers, URLs, prompts, screenshots,
or raw receipts into the release.

Count each source occurrence once across fingerprint rows. Technology joins
must not multiply observations. Historical comparisons require technology
evidence from the relevant audit, not today's hostname-level technology state.
The internal rollup counts distinct occurrence IDs, distinct affected sites,
and distinct currently detected frameworks. It clears stored hostname examples.
Those internal counters are diagnostic data, not a public research dataset.
The seed command uses this shared rollup and reports only approved public-page
readiness. Seeding alone cannot authorize publication.

Linking failures to verified outcomes requires the same Site, relevant check
version and behavior, source observation, independently issued verification,
and a later observation for recurrence. A copied prompt, attempt, closed status,
missing Flag, incomplete run, or successful HTTP response cannot establish a
verified fix. No public fix-success dataset has been established in this work.

## Local validation and release

Validate a prepared aggregate without storage or publication:

```bash
npx tsx scripts/growth/validate-public-research.ts /absolute/path/release.json
```

The command prints only schema-validation state, counts, and dates. It explicitly
does not verify live permissions; public readers perform that check against
private source records. Test fixtures are
synthetic and must never be published. Installing an approved artifact into
production, deploying this boundary, refreshing production counters, removing
old public material, or publishing a research asset requires operator
authorization. The owner setting changes only private permission records. No public publishing
API, new database, migration, or scheduled publishing job is introduced.

Expiry or invalid source permission withholds the release at read time. The
release owner must rebuild/re-review or remove affected artifacts. Re-review or remove releases
when check versions or source permissions change. Historical public graph copy
and previously exposed hostnames require a production assessment after an
authorized deployment; local tests cannot establish that production is repaired.

## Live publication observation, 2026-10-13

Public HTTPS reads found 45 issue detail URLs in the production sitemap. Two
sampled pages display 13 and 12 sites, a three-site minimum, an examples section
and Dataset markup without the local reviewed scope. Live `llms.txt` advertises
the library without a reviewed-release qualifier. The aggregate-only receipt is
`metrics/public-discovery-2026-10-13.json`, with no example identifiers or page
contents. This confirms displayed behavior, not source permission provenance or
search-engine indexing.

Local LLM discovery now uses the same current eligible release as issue pages
and sitemap. It is dynamic and noncached. Missing, withdrawn, expired or
unavailable research removes the research section while retaining public guides
and tools. Deployment or removal of production material still requires
authorization under the goal objective.
