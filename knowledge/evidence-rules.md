# Evidence and Severity Rules

**Canonical home for evidence classification, severity definitions, and the Finish Plan anatomy.** Integrity Engine: [integrity-engine.md](./integrity-engine.md). Report contract: [report-contract.md](./report-contract.md).

## Evidence classes

### Confirmed

A reproducible, observable condition.

Examples:
- Broken link
- Failed request
- Console error tied to a task
- Form does not submit
- Incorrect redirect
- Missing required metadata
- Journey success assertion fails
- Accessibility rule violation
- Mobile control cannot be reached or activated

### Observed

A measurable interaction issue.

Examples:
- Repeated attempts were required
- The agent reached an empty state without guidance
- An action produced no immediate feedback
- The primary action was unavailable in the tested viewport
- Labels contradicted the destination
- Recovery required returning several steps

### Suggested

A judgment-based recommendation.

Examples:
- Headline may be too broad
- Trust evidence may appear too late
- Plan differences may be difficult to compare
- The visual hierarchy may dilute the primary action

## Severity levels

### Blocker
Must be confirmed and must prevent an agreed goal.

### High
Must be confirmed or strongly observed and directly affect an important path.

### Medium
Affects clarity, effort, trust or discoverability without blocking the task.

### Polish
A lower-impact suggestion.

**Rule:** An LLM-only opinion can never receive Blocker severity.

## Critical Flag policy

Before a Flag can be critical:
- The failure must reproduce
- The success assertion must be explicit
- Evidence must be saved
- The finding must survive a deterministic review
- The run must not contain a known infrastructure failure

## Finish Plan anatomy

### Report header
> Fix these before you share it
> 1 blocker found in the paths we tested
> Checked: 14 routes, 51 links and actions, Desktop and mobile, 3 important journeys

### Journey summary
Each journey receives one status:
- Passed
- Passed with friction
- Blocked
- Could not verify

### Flag order

1. **Confirmed blockers** — Failures that prevent a defined goal
2. **Observed friction** — The task completed, but an observable problem increased effort or uncertainty
3. **Suggestions** — Heuristic improvements that may strengthen clarity or polish

### Flag anatomy

Every Flag contains:

- **What happened** — A factual description
- **Evidence** — Replay, screenshot, request, error or page state
- **Why it matters** — The goal or system requirement affected
- **Confidence** — Confirmed, observed or suggested
- **Fix** — The smallest useful change
- **Scope** — What should remain unchanged
- **Verify** — The exact condition FixFlags will test again

### Example

**Account creation gives no visible response on mobile**

*Confirmed blocker*

**What happened:** FixFlags entered a valid email and selected Continue twice. The page did not navigate, show a confirmation or issue the expected request.

**Why it matters:** A new visitor cannot complete account creation on the tested mobile viewport.

**Fix:** Ensure the submit action fires once, display a loading state immediately, and show either a success state or actionable error.

**Verify:** Repeat the journey at the same viewport and confirm that the account is created and the dashboard is reached.

## Evaluation system

FixFlags must evaluate itself more rigorously than it evaluates customers.

### Seeded benchmark

Build at least 100 controlled web products containing known problems across: navigation, authentication, forms, mobile layout, empty states, errors, loading, accessibility, metadata, performance, trust, copy clarity, goal completion.

### Measures

- Detection recall
- Precision
- Severity accuracy
- Goal-completion accuracy
- Reproduction success
- Fix usefulness
- Re-check accuracy
- Cost per useful Flag
- Cost per verified fix

### Human calibration

Regularly sample: confirmed Flags, dismissed Flags, suggestions, failed journeys, could-not-verify journeys. Use expert review to update the rubric.

### No composite score at launch

Do not lead with a 0-100 score until FixFlags can demonstrate that the score is stable, interpretable and correlated with validated product outcomes.

## Measurement

### Core value metric

**Verified fixes.** A verified fix requires:
1. A Flag was created
2. The customer viewed the evidence
3. The customer accepted or attempted the fix
4. The product changed
5. FixFlags reran the same verification
6. The original problem no longer occurred

### Trust metrics
- False critical rate
- Confirmed Flag precision
- Reproduction success
- Journey flake rate
- "Could not verify" rate
- Suggested Flag acceptance
- Dismissal reasons
- Support complaints caused by incorrect findings
