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
The index, sitemap, `llms.txt`, related links, preview counts, and detail pages
use the same validated release. Metadata, page content, and related links
share one snapshot within a render. Each new request rechecks eligibility.
The sitemap uses the release review date for the library and issue URLs.
`llms.txt` links to the library and up to 20 eligible issue pages. A missing,
invalid, future-reviewed, or expired release yields no public issue entries.
The existing library empty state remains available.

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
existing tenant authority and rechecks the Project owner. Grants and
withdrawals are append-only `public_research_consent` entries in private
`SiteLifecycleEvent` history, with policy version, actor, timestamp and a hash of
the Site origin and base path (excluding query strings and fragments). Consent is not a browser analytics event and is never inferred
from tracking consent. No new table or migration is required. Project row locks
serialize writes; repeat saves do not create new grants. An opt-in requires
the current wording and an active account. The grant records the owner's
account lifecycle revision under the same lock used for account suspension
and erasure. Withdrawal remains available to an authorized owner without
agreeing to a new policy. A current owner, account revision, or Site-address
mismatch makes a prior grant ineligible. After reactivation, a fresh
prospective grant is required. Older receipts without an account revision
remain eligible only for active accounts at their initial revision. Bump the policy
version whenever the permitted scope or consent wording changes meaning.

The grant also records the Site settings target revision. Editing the target
invalidates the prior grant, even if the owner later restores the original
address. A fresh grant applies prospectively and cannot restore the old
release. Receipts without a target revision can qualify only at the first
recorded target revision. The counter cannot establish edit history before
revision tracking began. This check uses the existing
`20261108120000_watch_target_revision` migration. A database predating
that migration cannot evaluate research eligibility under this rule.

Removing a Site with a retained grant records a withdrawal in the same
transaction as removal. Restoring the Site leaves research consent off even
if the account and target are unchanged. A fresh opt-in applies to future
audits only. The removal record contains no Site address or audit data.
Removals that predate this rule have no such withdrawal record.

Permission receipts follow private Site-history retention and deletion rules.
The new event stores no URL, page content, credentials, visitor identifier or
connected-provider payload. Site deletion, a current ownership mismatch, or
an account lifecycle revision change makes those sources ineligible even when
the permission receipt remains in history.

## Private source manifest

A customer-derived public release also requires an existing `GrowthArtifact`
with `path = research/public-issues/v1/permissions` and
`kind = approved-private-research-permissions-v1`. Its exact schema lives in
`lib/growth/research-permissions.ts`. It contains the version, matching release
evidence reference, a bounded array of `{ projectId, grantId, auditId }`
sources, and two digests recorded at review. `reviewedInputSha256` binds
the public release and manifest source list. `reviewedEvidenceSha256`
also binds the retained source scope and dates, counted Flags, their
supporting observations and matched receipts, and the technology facts
used by any published framework cells.
This manifest stays private and must never be committed as customer data or
included in public models. Keep it in existing authorized operator storage.

Every public read uses one read-only database snapshot for the release,
manifest, permissions, and supporting evidence. A missing or mismatched
review digest withholds the whole release. Replacing a counted finding or
receipt can invalidate review even when the public totals stay the same.
The reader also checks that the source Project exists and is
active, its current owner and Site address match the grant, its latest consent
is enabled, and the manifest names that exact grant. Each completed source audit must belong
to that Site and owner, remain within its origin and base path, start after consent, and complete
within the reviewed observation window. Each source also needs recorded public
scan access in the Site's production environment, an eligible execution scope,
and no stored scan credential. Preview, authenticated, account-check, fixture
setup, and legacy sources without public access metadata are withheld. Audit
targets with a query or fragment are ineligible because they can carry access
tokens. The research scope check also withholds ambiguous Site and evidence
paths, including encoded separators, nested escapes, path parameters, and
repeated slashes. Servers can decode or normalize these paths differently.
[Apache encoded slash handling](https://httpd.apache.org/docs/2.4/mod/core.html#allowencodedslashes) ·
[NGINX location matching](https://nginx.org/en/docs/http/ngx_http_core_module.html#location)

Distinct source hostnames must match the
released sample size. The sample and every published issue or framework cell
also need at least 20 separate groups. Audits sharing a normalized hostname
or current owner account belong to one group. Links through another source
in the sample count, even if that source is outside the cell. Hostname
normalization folds `www` and the trailing DNS dot into the bare hostname.
This rule covers relationships recorded by FixFlags. Common ownership
across unrelated accounts and hostnames remains unverified. Missing, stale, revoked, regranted, transferred, off-site,
pre-consent or deleted sources withhold the whole release until it is rebuilt and
reviewed. Re-enabling consent cannot restore an old release automatically.

Issue counts are checked against distinct eligible deterministic Flag IDs and
affected hostnames, with confidence at least 0.8. Page-scoped identities contribute
to their canonical base check. AI interpretations, connected Search, legacy
Search Performance, and automatic account findings are withheld.
Legacy deterministic IDs such as `low-ctr` can come from connected Google data,
so a registered ID alone does not prove public provenance. Framework cells
must match confident technology observations from the affected source audits.
Each observation must match its audit's recorded detector version and capture
time within that audit. The public capture must start at the audit target, and
both its requested and final URLs must stay within the consented Site and omit
queries and fragments. A partial capture can establish framework presence.
The review digest binds the recorded capture scope. Older framework-cell reviews
need a fresh preflight and review. Current hostname-level technology state
cannot substitute for an eligible capture.

The public reader and local preflight require each counted Flag to match the
declared check version on a completed deterministic receipt from the
module that owns that check version. Each supporting observation must
match the receipt's audit, task, and exact page within the consented Site's
scope by the release review date. The same task must have emitted a
deterministic finding with the recorded check identity, page, evidence, and
collection time. The module receipt, task output, and supporting observation
must agree on a valid collection timestamp within the source audit.
Page-response findings also require a conclusive failure assertion with
matching evidence and scope. Where an observation has no
recorded page, only a receipt for the original audit target can corroborate
it. Missing, mismatched, or post-review evidence withholds the release. Findings,
technology observations, and distinct per-finding page references are
each bounded at 50,000. A read that exceeds a limit or cannot complete
withholds the release.

The preflight counts corroborated findings and affected sites. The
manifest's sampled-site count does not prove that a detector completed
on every sampled site, so it cannot supply a rate denominator. Human
review still establishes methodology, detector coverage, and the privacy
and accuracy of free-form copy.
Previously served external copies of anonymous aggregates cannot be
recalled. New FixFlags requests stop serving a release once its source grant is
withdrawn; request-time rendering prevents a static cached page from bypassing
that check.

The sitemap and `llms.txt` send `Cache-Control: no-store`. Check a known
retired slug directly as well as on the listings:

```sh
node --import tsx scripts/growth/verify-live-seo.ts --withdrawn-issue page-http-error
```

The check reads the issue library, sitemap, `llms.txt`, and the named detail
URL. It verifies the listings omit that issue, the detail returns a withheld
response, and all four responses declare no-store without a positive cache
age or conflicting cache override. A streamed HTTP 200 must have a
not-found title or heading and noindex. Earlier copies and other cache
locations are outside this observation.

On November 9 at 17:07 UTC, the public responses withheld
`page-http-error` from all three listings and served a noindex fallback at
the old URL. The sitemap response still used public revalidation and failed
the no-store check. At 17:10 UTC the isolated Next production build passed all
eight checks over loopback. The local route change requires deployment
authorization.

The sitemap cache fix was also replayed on the serving revision
`3e7453bc20d3d79c3e72730c64ee90d0af9c4ed7`. The four-file patch
(`5d41cc0d3a2a546d0ab60f857f52f00d1d1628da11321bc0eb9254f35bd002cf`)
passed 16 focused tests and the power-tools visibility guard. Its production
build served all 67 live sitemap entries with the same fields and order and
passed all eight withdrawal checks against an empty local PostgreSQL database.

## Preparing evidence

Prefer a deliberately authorized research cohort over opportunistic reuse of
customer data. Define permitted collection and publication, observation dates,
check coverage and versions, distinct-site identity, retention, withdrawal, and
sampling limitations before preparing aggregates. Keep private evidence in its
existing authorized storage. Do not put identifiers, URLs, prompts, screenshots,
or raw receipts into the release.

Use the private readiness inspector to see whether any issue can meet the
sample floor. Run it against an authorized loopback database:

```sh
node --import tsx scripts/growth/inspect-research-readiness.ts 60
```

It uses the latest owner choice even for earlier audit windows. Only audits
completed within the requested window and created after the current grant
can qualify. It counts distinct hostnames and eligible Flag occurrences
using the same scope rules as the public reader. Below the 20-group floor
it does not load findings. Above that floor, every issue, check version,
and coverage or recovery cell must meet the same floor before its count
is reported. The output omits Site and Audit identities,
private manifests, content and technology breakdowns.

An older database without `projects.watchTargetRevision` returns
`consent-schema-unavailable` with a nonzero exit. The diagnostic can tell
whether research-consent history was retained, without classifying any
grants or reporting eligibility counts. Use a current authorized loopback
schema for a readiness report.

`corroboratedVersions` lists separate cohorts when each version reaches
20 distinct sites. Every supporting observation for a counted Flag must
name the same check and version, and a completed deterministic receipt
from the owning module must corroborate each observation's audit, task,
page and version. The committed task output must contain the finding.
The registry supplies module identity and labels whether
a corroborated version is current. A missing version
cohort can mean missing custody, mixed versions or too few sites. The report
does not read finding content into its output and does not treat legacy
observations as current-version evidence.

This is a planning report. A matching version supports method comparison.
Actual coverage, sample bias, permitted use, and copy still require review
before any publication.

When the operator has already selected a private cohort, derive the draft
counts for one eligible issue from its unreviewed manifest.

```sh
node --import tsx scripts/growth/prepare-research-draft.ts /private/manifest.json security-headers-missing 2026-10-01T00:00:00Z 2026-10-31T23:59:59Z
```

The command uses a read-only loopback database snapshot and the same source,
independence, version, and applicable page-response coverage checks as the
release preflight. It withholds the draft when any manifest source is
ineligible or an issue cell falls below the privacy floor. The result
contains aggregate counts and an evidence cutoff. Keep the manifest private.
Use the counts in the separate methodology, copy, and permission review,
then rerun the release preflight with the reviewed release and its actual
review timestamp. The draft is ineligible for publication.

For the public page-response method, the private inspector can count
distinct eligible sites with a conclusive observation of an audit entry page.

```sh
node --import tsx scripts/growth/inspect-research-readiness.ts 60 --page-response-coverage
```

The report requires a complete, applicable HTTP receipt for the exact
entry URL and assertion context, with the current page-error and
redirect-loop check versions. The receipt must link to its single completed
HTTP task for the same audit and page, with a matching collection timestamp.
The final destination and every recorded redirect must stay within the
consented Site and omit queries and fragments. Findings use the same scope
rule, including findings from pages other than the entry page. A passing assertion needs the recorded
response qualification marker. A conclusive failure also counts as an
observation. Duplicate audits count once per hostname. Missing, late,
incomplete, or mismatched receipts leave coverage unproven. Counts below
20 are withheld. The report omits page identities and the pass/fail split.

The release preflight includes the same coverage field for proposals
containing a page-response issue, using only manifest audits and receipts
retained by the review cutoff. Every sampled hostname needs a conclusive
entry-page observation before preflight can issue an evidence digest.
That digest includes the qualifying coverage receipts, including passes, and
their recorded HTTP task identity and destination scope.
The public reader rechecks coverage and the digest before serving the
release. Earlier page-response digests require fresh review. The scope
remains entry pages, so the coverage count cannot establish a prevalence
rate for all pages or all sites.

The same inspector can check readiness for native public availability recovery.

```sh
node --import tsx scripts/growth/inspect-research-readiness.ts 60 --recoveries
```

This mode uses the current scoped grant and recorded public access on the
original failure, recovery, and every scheduled observation. The underlying requests and settled audits
must fit the observation window and begin after consent. It requires the
current default public availability evaluator throughout the sequence, an
in-scope target, and the native Flag resolution and binding receipts. The
recorded binding version, verdict, and conclusive attempt must agree with
the assessment. A failure requires both recorded confirmation attempts.
Every attempt must have taken place within its run and use a requested URL
matching the binding. The recorded final HTTP and rendered destinations must
stay within the consented Site and omit queries and fragments. This checks
recorded landing URLs. Intermediate redirects remain unobserved in the binding
receipts. The method excludes custom availability predicates, fixture bindings, Checkout,
and Signup. The output omits source identities and withholds the candidate
below 20 recovered groups. Mature follow-up, comparable scheduled
results, and failure after a pass report only whether they reach the same
floor. They do not expose exact sub-cohort counts or success rates.

To draft a recovery study from an operator-selected cohort, use the same
unreviewed private manifest format and include the exact original failure,
recovery, and scheduled audit records to be evaluated.

```sh
node --import tsx scripts/growth/prepare-research-draft.ts /private/manifest.json --recoveries 2026-10-01T00:00:00Z 2026-10-31T23:59:59Z
```

The command checks each manifest source against its current grant in one
read-only snapshot. It counts only eligible native recoveries in the listed
audits. Within mature seven-day recovery windows, it checks for retained
scheduled receipts using receipt identity and timing. If any lack eligible
manifest evidence, the comparable follow-up and recurrence fields are both
`null`. The check returns no omitted identities, observations or counts.
Pending, deleted and otherwise unobserved runs remain unknown. A recovery
below the privacy floor yields no draft. The
`reviewable-recovery-draft` output has no source identities or release
approval. It supports study review, and it cannot be used as an issue release.

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

The first command checks the proposed release's structure. Use the second with
the matching private source manifest and a loopback PostgreSQL `DATABASE_URL`.

```bash
node --import tsx scripts/growth/validate-public-research.ts /absolute/path/release.json
node --import tsx scripts/growth/validate-public-research.ts /absolute/path/release.json --manifest /private/manifest.json
```

Keep the manifest in private storage. The preflight checks current grants, exact
source audits and published counts in a single read-only snapshot. Each counted
finding needs a completed receipt that corroborates the declared version by the
release review time. A version receipt completed after review cannot support
that proposal. The report identifies the checked inputs by SHA-256 and prints
aggregate counts without source identities. For the proposed pair, omit
both review digests and retain the successful preflight's `inputSha256`
and `evidenceSha256` in the private review record. After reviewing those
exact inputs and the retained evidence, the authorized reviewer records
them as `reviewedInputSha256` and `reviewedEvidenceSha256` in the private
manifest. Rerun preflight on the reviewed pair before installation.
The evidence digest binds committed task findings and the current owner
accounts used to establish the privacy floor. Manifests reviewed under an
earlier digest format or with only the input digest require fresh review. The CLI
rejects stale digests and writes no artifacts.

The local result requires separate review of methodology, coverage, privacy
and public copy. The digest binds that review to the validated contents.
Authorization comes from the reviewer and control of the approved artifacts.
Changed copy, dates, references, counts or sources require fresh review.
Public readers also repeat the source and version checks against the records
available at read time. Synthetic fixtures are only for local validation.
Installing an approved artifact into
production, deploying this boundary, refreshing production counters, removing
old public material, or publishing a research asset requires operator
authorization. The owner setting changes only private permission records. No public publishing
API, new database, migration, or scheduled publishing job is introduced.

A controlled editorial study can demonstrate specific observed behavior using
hand-authored inputs. Keep its public projection separate from the customer
issue library and label the method and limits beside the results. Show contrary
cases and observation gaps. Withhold raw operational records, prevalence claims,
and builder comparisons. The [destination study](destination-study.md) uses
this approach and remains withheld from production until authorized.

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
