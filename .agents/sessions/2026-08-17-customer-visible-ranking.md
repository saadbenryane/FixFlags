# Diagnosis: customer-visible ranking is the unblocked Judge constraint

**Date:** 2026-08-17
**Status:** implemented in working tree; verification this cycle
**SHIPPED / NEXT / VISION:** ranking of existing Flags is SHIPPED Judge behavior. Product Graph, "Fix it for me", and unsupported mobile-CTA verdict grounding remain NEXT / owned elsewhere.

## Problem

FixFlags can surface many Flags while the first thing a customer hears or reads is SEO hygiene. The ideal reaction is "FixFlags saw something important I missed," not "it found meta tags."

## Evidence

- Live `example.com` Agent transcript named meta description, og:image, and og:title first, then "13 more Flags."
- Agent announcement used discovery order (`slice(0, 3)`), then a separate announcement ranker.
- Report list, Finish Plan, and `groundedReportVerdict` used `compareFlagPrioritySignals`, where Important SEO could beat Important Message/CLARITY.
- Exclusive lane `continuous-improvement-system` already owns the production mobile-CTA false verdict. Not taken.
- Exclusive `game-on-*` lanes cover release receipts, Watch entitlements, and the Improvement ledger. Not taken.

## Hypothesis

One comparator that, after severity, demotes SEO / sharing / measurement Flags will make Agent, Report, and Finish Plan lead with customer-visible Message/Experience without hiding any Flag.

## Guardrails

- Do not hide Flags or invent verdicts.
- Critical SEO still outranks Important Experience.
- No Prisma, no `lib/improvements/**`, no `scripts/release-*`.

## Expected outcome

Time to first valuable judgment drops: the first named Flag and "Highest priority" line describe something a visitor would notice.

## Next constraint (if this holds)

Whether that top Flag is *true*. Ranking cannot save a false-positive CTA or headline Flag. That accuracy work is partly owned by `continuous-improvement-system`.
