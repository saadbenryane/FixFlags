# What a successful HTTP response tells you about a booking link

Local research draft. Method recorded on November 9, 2026 before running the
study. Publication requires approval.

The development guide preview is at
`/guides/website-online-but-not-working#http-200-booking-study`. Its table
reads the [serving-base replay](../../lib/growth/evidence/destination-study-serving-base-2026-11-09.json).
The production approval flag in
`lib/marketing/copy/destination-study.ts` defaults to false. Production
withholds the table, study citations, and revised article and sitemap dates
while approval is pending. The preview uses the guide's existing Analyze link.

## Question

When checking the booking link on a freshly deployed site, which problems can
you see from the HTTP status, and which require a look at the response body or
a separate browser check?

HTTP 200 means the request succeeded under the HTTP protocol. An application
can still send a missing-page screen in that response. Google calls that a
soft 404. [HTTP Semantics, section 15.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#name-200-ok) ·
[Google Search Central on soft 404s](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors#soft-404-errors)

## Method

Use a fixed set of synthetic GET responses. Compare a simple 2xx signal with
FixFlags' existing public destination check. The fixture designs specify what
the response represents before the checker runs. Keep the status and the
checker verdict separate. Treat a blocked or incomplete response as an
observation gap. Run a soft failure, a repair, and a repeat failure in that
order against the same booking URL. The other fixtures are independent cases.

The hypothesis is that reading the body will distinguish an explicit 200
missing-page response from a good response with the same status. A returned
page can still be the wrong page, and a useful article may discuss 404s. Include
both cases to see where the destination check's inference ends or overreaches.
Report every case, including results that contradict the hypothesis.

The replay uses the real destination evaluator with an injected HTTP transport.
It exercises status, headers, and bounded response bodies. No browser,
customer record, AI builder, or live site is part of the sample.

## Results

This section preserves the original November 9 worktree replay. See the
serving-revision comparison below for the public candidate's results.

The booking URL returned HTTP 200 throughout the break, repair, and recurrence.
The status-only signal stayed positive on all three observations. The destination
check classified the first and third responses as missing and accepted the
restored booking document on the middle observation.

| Controlled response | HTTP status | Destination observation |
| --- | --- | --- |
| Booking page with a “Choose a time” link | 200 | Reachable |
| Removed page that returns its missing status | 404 | Missing |
| Booking URL with a missing-page message | 200 | Classified as dead |
| Restored booking page at the same URL | 200 | Reachable |
| Missing-page message returns at the same URL | 200 | Classified as dead |
| Homepage served at the booking URL | 200 | Reachable, despite the wrong content |
| Initial loading shell at the booking URL | 200 | Reachable, with the eventual browser state unobserved |
| Access challenge | 200 | Blocked |
| Booking document beyond the response-body budget | 200 | Unknown |
| Working article titled “How to fix a 404 error” | 200 | Incorrectly classified as dead |
| Member booking behind a sign-in gate | 401 | Authentication required |

The destination check used body evidence to detect an explicit missing page
despite a success status. It also treated a valid article about HTTP 404 as
missing. This is a concrete false positive for the evaluator tested here.
The table gives the full case set. The two observations of the soft 404 use the
same response body and do not count as independent examples of the heuristic.

## Verify the original link after a deploy

1. Start on the page where a visitor clicks the link. Record the destination URL,
   response status, and what the page is supposed to show.
2. Open the link in a browser. Look for something specific to the intended page,
   such as the booking title and time selector. A homepage or a loading screen
   can arrive with the same HTTP status as a working page.
3. After changing the route, repeat the same check at the original URL. If the
   repair involves a redirect, check that its final page meets the same expectation.
   If the task is to book a time, verify that action separately with a test booking.
4. Keep blocked and incomplete checks open for a comparable observation. Record
   a repeat failure if it returns on a subsequent check.

## Product finding

The destination evaluator treated a bare `404` in the article title and H1 as
missing-page evidence. The same run correctly classified the explicit missing-page
fixture. Use both cases when assessing a refinement. The desired result is to
preserve the explicit missing-page detection while keeping a legitimate article
reachable. A narrower rule would need additional controls for other error
templates before replacing the existing behavior.

## Reproduce

```sh
node --import tsx scripts/growth/run-destination-study.ts
node --import tsx scripts/growth/run-destination-study.ts --verify
```

The [saved observation](metrics/destination-study-2026-11-09.json)
records the observed date, base revision, selected evaluator file digests,
fixture digest, and all eleven case results. Use the same fixture digest to
compare a later evaluator revision. These hand-authored cases identify specific
behaviors. They cannot estimate prevalence, detection rates on real websites,
customer repair outcomes, or differences among AI builders.

`--verify` compares the fixture digest and verdicts with the saved worktree
receipt. It reports a source fingerprint difference separately when the
worktree still reproduces the same results.

The 13:07 UTC replay on November 9 matched all eleven results and the
fixture digest. The shared soft-404 source file had changed to SHA-256
`64e17be8211c044792f19d40aee390bed14c1c7d266a9756dc37f054b4b7b0ac`.
The original receipt retains the original source fingerprints.

## Replay on the serving revision

The same eleven fixtures ran on `3e7453bc` at 14:32 UTC. Ten verdicts matched
the original worktree receipt. The oversized response returned **Reachable**
on the serving base and **Unknown** in the original worktree replay. Both
recorded HTTP 200. The serving revision's collector can return a document
with `complete: false` when it reaches the byte limit. Its destination
adapter does not pass that value to the classifier on the ordinary
document return path. The newer worktree passes completeness through.

The [serving-base receipt](../../lib/growth/evidence/destination-study-serving-base-2026-11-09.json)
now supplies the proposed guide table. It shows the reachable verdict and
the body limit together. The original receipt stays available as evidence
for the newer evaluator behavior. The two reports used controlled inputs.
No public live site was scanned to obtain these verdicts.

```sh
node --import tsx scripts/growth/run-destination-study.ts --verify-serving-base
```

The command extracts the pinned Git revision into a temporary directory.
It requires the recorded Node version and checks the selected evaluator file
digests before replay. It uses installed dependencies whose recorded package
versions match the archived lockfile, reports lock entries that are absent
locally, and removes the archive after the run. The fixture and all verdicts
must match the saved serving-base receipt. This checks package version
metadata and does not verify installed package bytes. The transport uses
synthetic responses and needs no live requests.

## Native collection and verification inputs

This follow-up replaces the transport underneath the bounded collector. It
exercises the default destination path, the public-link check's routine and
targeted repair modes, and replay from the native HTTP receipt. The runner
serves only synthetic streams for a single fixed URL. It checks whether the
collector canceled the stream and whether the public-link assertion passed
and was complete. Each receipt replay must reproduce the assertion state and
Flag IDs without a second request.

| Controlled observation | Archived serving revision `3e7453bc` | November 9 worktree |
| --- | --- | --- |
| Explicit missing page with HTTP 200, initially and again at the same URL | Complete failure, Flag | Complete failure, Flag |
| Ordinary HTTP 200, body over 20,000 bytes | Collection stopped, complete pass | Collection stopped, incomplete |
| Targeted recheck of the same body | Collection stopped, complete pass | Complete collection, complete pass |
| Targeted HTTP 200, body over 64,000 bytes | Collection stopped, complete pass | Collection stopped, incomplete |
| Explicit HTTP 404, oversized body | Complete failure, Flag | Complete failure, Flag |
| Valid troubleshooting heading, cut just after “Page not found” | Complete failure, false Flag | Complete failure, false Flag |
| Same troubleshooting wording, complete body | Complete failure, false Flag | Complete failure, false Flag |
| Explicit closed missing-page heading before the cutoff, HTTP 200 | Complete failure, Flag | Complete failure, Flag |

The older revision let an incomplete 200 produce a passing assertion even
in a targeted check of the originally failed destination. The worktree
propagates the incomplete observation and uses a wider collection limit for
targeted checks. Its valid troubleshooting page still produces a false Flag
both with and without the cutoff. The broad missing-page interpretation is
therefore a separate issue from propagation of the body limit.

For product engineering, retain the nine cases as paired controls when
reviewing the destination check. Incomplete success responses without
conclusive failure evidence should stay incomplete through receipt replay.
Keep the explicit HTTP 404 and the closed missing-page heading as failure
controls when refining which wording can raise a Flag. Keep the working
troubleshooting page in the suite in both forms. The check-level replay
does not issue a repair receipt or a recurrence outcome. These observations
give no basis to retroactively reclassify historical customer outcomes.

```sh
node --import tsx scripts/growth/run-destination-collection-study.ts
```

The [serving-revision receipt](metrics/destination-collection-serving-base-2026-11-09.json)
and [worktree receipt](metrics/destination-collection-worktree-2026-11-09.json)
have the same fixture and runner fingerprints. The first ran on a fresh Git
archive of the base revision, with the runner copied in. The second used
the files fingerprinted from the shared worktree. Neither uses customer
data, production traffic, a browser, or a database. These receipts belong
to the local product handoff.

## Follow-up comparison of two FixFlags checks

The destination checker and the page-response check read missing-page wording
differently. This follow-up compares them on the same complete HTML with HTTP
200. It reuses three original controls and adds seven fixtures. The fixture
author labels each response as a page that is present or a missing-page
template before the checks run. The cases cover branded headings, a bare 404,
body-only error text, a contact extension, hidden markup, and a notice about
an expired offer on an otherwise working page.

The hypothesis is that the page-response check will avoid some false alarms
from broad wording while missing some error templates without a plain label.
The comparison uses the existing link-destination evaluator with injected GET
responses and the existing page-response assessment with the same complete
HTML and headers. The inputs stay below the link check's collection limit.
Record each verdict and compare it with the fixture label. This procedure
exercises classification only. Both checks can miss a broken interaction,
and the paired results do not estimate accuracy on customer sites.

The replay recorded these outcomes across the ten fixtures.

| Supplied response | Link destination marked missing | Page-response check flagged |
| --- | ---: | ---: |
| Five missing-page templates | 5 | 2 |
| Five working pages | 4 | 0 |

Both checks flagged the original missing template and the branded title
paired with a plain “Page not found” heading. The page-response check cleared
the branded title and branded heading, the bare 404 label, and the generic
heading with missing-page text in the body. The destination checker marked
all three as missing.

The destination checker also marked the working 404 article, the phone
extension, the hidden error heading, and the expired offer notice as missing.
The page-response check cleared all four. Those fixtures distinguish several
causes of false alarms that the original article case alone could not isolate.
Use the paired cases to evaluate a wording change against both missed
templates and false alarms.

```sh
node --import tsx scripts/growth/run-destination-study.ts --compare-page-response --verify
```

The [comparison receipt](metrics/destination-page-response-comparison-2026-11-09.json)
retains all ten verdicts, the case digest, and selected evaluator fingerprints.
Verification compares the fixture and verdicts with that receipt. The
guide draft uses the separate eleven-case serving-base replay. The paired
comparison remains a local research follow-up pending review.
