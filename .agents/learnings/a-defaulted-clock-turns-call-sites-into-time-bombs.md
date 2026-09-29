# A defaulted clock turns every existing call site into a time bomb

**Date:** 2026-09-29. **Found in** `site-coverage-freshness-2026-09-29` (codex-01a0ec19,
in progress), while verifying unrelated work. Recorded here because the class will recur in
this repo's own freshness work and because the prevention is a design decision, not a fix.

## What happened

The change under review added a validity window for completed broad Site checks:

```ts
export const SITE_COVERAGE_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000
export function siteCoverageIsStale(checkedAt: Date | string | null, now = new Date()): boolean
```

Adding a `now` parameter with a **default of the real clock** makes staleness a function of
wall time at every call site that omits it. Three existing tests were updated to pass an
explicit `now`. One was missed:

```ts
// lib/sites/__tests__/card-areas.test.ts, "can be healthy only when required starter areas were evidenced"
buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: new Date('2026-09-08T12:00:00Z'), ... })
siteCardHealth({ inFlight: false, finished: true, hasLastKnown: false, flags: [], coverage })
expect(health.state).toBe('healthy')
```

No `now`, so the check ran against 2026-09-29. The completed check was 21 days old, which is
past the new 8-day window, so the Site correctly reported `Check out of date` and the test
failed with `expected 'unknown' to be 'healthy'`.

The test was **green when it was written and is red now**, for no reason connected to the
code under test. That is the whole danger: the assertion stopped testing the invariant it was
written for and started testing the date.

## Why it is easy to miss and why "just add `now`" is not the lesson

Adding `now:` to the four call sites fixes today's failure and leaves the trap armed, because
the default is still `new Date()` and the next person to add a call site lands in it again.
The compiler cannot help either: an optional parameter is, by construction, a parameter that
can be omitted.

The general rule:

**A time-dependent decision must take its clock as a required argument at the boundary, and
only the outermost entry point may default it to the real clock.**

Concretely: the pure function takes `now: Date` with no default. The single composition root
that reads real time — the audit worker, the request path, the query loader — passes
`new Date()` once. Then a call site that forgets the clock does not compile, and a test that
forgets the clock is a type error rather than a date bomb.

This is the same instinct as the site `baseURL`/port lesson, and the same instinct as
`validateBindingConfig` being the single source of truth for watchability: **put the
environment-dependent value at exactly one seam, so every other module is a pure function of
its arguments.**

## The review habit this exposes

A green suite is evidence about the moment it ran. A test that hardcodes a past date and omits
a clock is a test whose result is a function of when you run it, and it will pass in review
and fail in CI three weeks later, attributed to an unrelated change.

When reviewing or writing anything with a validity window, ask of every assertion: *what would
this return if I ran it next month?* If the answer requires knowing today's date, the
assertion is incomplete.
