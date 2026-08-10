# Launch Requirements

**Canonical home for launch readiness criteria and validation plan.** Execution plan: [execution.md](./execution.md). Product system: [product-system.md](./product-system.md).

## Launch requirements

Do not launch broadly until:
- The public check regularly produces a useful first finding.
- The first evidence appears quickly.
- Critical findings are precise.
- One journey can be replayed reliably.
- Fix prompts are specific enough to apply.
- The update review can prove a real before-and-after change.
- The report is visually shareable.
- Privacy and scope are obvious.
- Paid deep review is purchasable without friction.
- At least ten paid users are converting to recurring plans.

## Launch demo

The Product Hunt demo must show:
1. An AI-built product,
2. A clear user goal,
3. FixFlags attempting that goal,
4. The exact failure,
5. Evidence,
6. The fix sent to the builder,
7. The same task passing after the change.

## Validation plan

Before full rollout, manually validate the value ladder.

### Cohort

Recruit:
- 20 solo AI builders approaching launch,
- 10 freelancers or agencies,
- 5 small product teams.

### Test

For each participant:
1. Run the current Product Review.
2. Ask for one important path.
3. Run the path manually or with supervised agent flow.
4. Provide evidence.
5. Provide a builder-ready fix.
6. Re-run update review after the change.
7. Ask for upgrade for continued watch or deeper review.

### Pricing tests

Verify willingness for paid depth and retention with realistic offer framing:
- Paid Deep Review framing,
- Watch + Pro value, and
- launch discount behavior.

## Required proof before scaling

- 70% of completed users rate at least one high-impact Flag as useful.
- 40% attempt a recommended fix.
- 30% run an update review.
- Fewer than 2% of critical Flags are false.
- Ten customers purchase a paid Deep Review surface.
- Five agencies use FixFlags on a second product.
- Five teams connect a deployment or request watch.
- At least 20% of paid launch customers choose recurring Watch.
- Positive gross margin at expected usage.

Product Hunt upvotes and waitlist metrics do not equal PMF.

## Cost requirements

Browser infrastructure can stay efficient with session reuse and bounded runs.

### Internal cost targets
- Product review: controlled unit budget,
- Deep Review: deeper but still bounded,
- Watch run: low marginal recurrence,
- Gross margin: above 80% across paid usage.

### Cost controls

- Fetch before opening browser,
- deterministic checks before agents,
- deduplicate templates,
- reuse sessions,
- cache summaries,
- capture screenshots only at meaningful states,
- small models for classification,
- stronger models for selective evidence,
- hard action/retry limits,
- re-run only affected journeys,
- limited visual computer-use calls.

## Safety and privacy

The inspected page is untrusted input.

### Required protections

- Treat page content as data, never as instruction,
- strict allowlist and tool allowlist,
- separate navigation from judgment,
- no cross-product credential reuse,
- ephemeral browser contexts,
- encrypted test credentials,
- secret redaction,
- personal-data redaction,
- no real payments in QA,
- no production destructive actions,
- no public recruiting in private environments,
- no unrestricted uploads,
- no executable download execution,
- human approval for any state-changing action outside policy.
- Private reports by default,
- public links only through explicit action,
- customer evidence excluded from training by default.

### Test-account support

Customers can provide: a dedicated test user, allowed roles, seed data, reset instructions, test inbox, payment sandbox, excluded areas, and private credentials.
