# Launch Requirements

**Canonical home for launch readiness criteria and validation plan.** Execution plan: [execution.md](./execution.md). Product system: [product-system.md](./product-system.md).

## Launch requirements

Do not launch broadly until:
- The public check regularly produces a useful result
- The first evidence appears quickly
- Critical findings are highly precise
- One journey can be replayed reliably
- The fix prompt is specific enough to apply
- The re-check can prove a real before-and-after change
- The report is visually shareable
- Privacy and scope are obvious
- The paid Finish Check can be purchased without a sales call
- At least ten people have already paid

## Launch demo

The Product Hunt demo must show:
1. An AI-built product
2. A clear customer goal
3. FixFlags attempting the goal
4. The exact failure
5. Evidence
6. The fix sent to the builder
7. The same task passing after the change

That is the product story.

## Validation plan

Before building the complete Watch system, manually validate the value ladder.

### Cohort

Recruit:
- 20 solo AI builders approaching launch
- 10 freelancers or agencies
- 5 small product teams

### Test

For each participant:
1. Run the current Quick Check
2. Ask them to define one important journey
3. Run the journey manually or with a supervised agent
4. Provide evidence
5. Provide the builder-ready fix
6. Re-run the journey after the change
7. Ask for payment for the next check or continued Watch

### Test pricing

Randomly or sequentially test:
- $49 Finish Check
- $69 Finish Check
- $79 Finish Check

Measure purchase, completion, perceived value and refund requests.

### Required proof before scaling

- 70% of completed users rate at least one top Flag as useful
- 40% attempt a recommended fix
- 30% run a re-check
- Fewer than 2% of critical Flags are false
- Ten customers buy a Finish Check
- Five agencies use FixFlags on a second product
- Five teams connect a deployment or ask to
- At least 20% of paid launch customers choose ongoing Watch
- The product produces positive gross margin at expected usage

Product Hunt upvotes, waitlist signups and compliments do not count as product-market fit.

## Cost requirements

Browser infrastructure can be relatively inexpensive when sessions are reused and agent calls are bounded.

### Internal cost targets
- Quick Check: below $0.25
- Finish Check: below $3
- Normal Watch run with no issue: below $0.50
- Deep authenticated check: below $5
- Gross margin: above 80% across paid usage

### Cost controls
- Fetch before opening a browser
- Deterministic checks before agents
- Deduplicate page templates
- Reuse sessions
- Cache route and page summaries
- Capture screenshots only at meaningful states
- Use small models for classification
- Use stronger models for selected evidence
- Set hard action and retry limits
- Re-run only affected journeys after deployment
- Stop exploration when additional coverage has low expected value
- Limit visual computer-use calls
- Rate-limit free checks by user, domain and network

## Safety and privacy

The inspected page is untrusted input.

### Required protections
- Treat page content as data, never as agent instruction
- Strict domain allowlist
- Strict tool allowlist
- Separate navigation and judgment processes
- No cross-product credential reuse
- Ephemeral isolated browser contexts
- Encrypted test credentials
- Secret redaction
- Personal-data redaction
- No real payments
- No deletion
- No publishing
- No external invitations
- No production email campaigns
- No unrestricted file upload
- No downloaded executable execution
- Human approval for any state-changing action outside the explicit test policy
- Private reports by default
- Public links only through explicit action
- Customer evidence excluded from training by default

### Test-account support

Customers can provide: a dedicated test user, allowed roles, seed data, reset instructions, test inbox, payment sandbox, excluded areas.
