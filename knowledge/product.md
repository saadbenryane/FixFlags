# Product

## Vision

> FixFlags turns an AI-built app into a product you can confidently put in front of users.

The mechanism: it understands what the app is meant to do, tries the critical journeys, identifies what could stop users, gives the builder or agent a precise repair contract, and verifies the outcome. The missing idea is intent and behavioral contracts.

## The Moat

URL-first autonomous testing is becoming table stakes (Scout, Signo, PageLens). The first moat cannot be "paste a URL."

**Moat:** Knowing which failure matters, producing feedback precise enough to resolve it, and learning whether the proposed repair actually worked.

Research on feedback-based automated verification found that precise, constraint-level feedback produced successful iterations while broad metric feedback often caused the coding loop to stall.

A score is weak feedback. "Signup is broken" is still weak feedback.

**Strong feedback:**

> After submitting a valid email on /signup, the account is created, but the interface remains on the signup screen. The user must land on /onboarding without submitting again. Refreshing must preserve the authenticated state. Re-check by creating a new account on desktop and mobile.

**Precision is the product.**

## Product Contract (Intent Layer)

A browser agent cannot know whether a product is working properly without understanding what it is supposed to accomplish.

Before testing deeply, FixFlags produces a tiny Product Contract:

```
This product appears to help:
  [inferred user and purpose]

The first-value journey appears to be:
  [inferred critical path]

Critical outcomes:
  1. [outcome]
  2. [outcome]
  3. [outcome]
```

The builder confirms or edits this. Then FixFlags tests against that contract.

**This solves:**
- Generic audits
- Irrelevant findings
- Unclear success criteria
- Subjective AI criticism
- Difficulty re-checking a repair
- Lack of continuity between runs

Over time, the Product Contract becomes project memory. That is significantly more valuable than another library of checks.

## Two Product Surfaces

### Product A: Launch Check

For Lovable, Bolt, Replit, and less-technical builders.

**Workflow:** Paste link -> show what is wrong -> copy instruction -> publish -> check again.

**Needs:**
- Plain language
- No setup
- No repository requirement
- 3 important findings
- Instructions phrased for their builder
- Very clear limits around security certainty

**Buying:** Confidence and direction.

### Product B: Release Verification

For agencies, developers, and product teams.

**Workflow:** Connect preview and repository -> evaluate critical journeys -> map evidence to implementation -> verify every relevant deployment.

**Needs:**
- Repository context
- Authenticated journeys
- Issue history
- Changed-area testing
- GitHub and Vercel integration
- Stable acceptance criteria
- Team ownership
- Audit logs

**Buying:** Reduced release risk and repeatable process.

**Key decision:** Trying to expose all of Product B inside the first Product A experience will make FixFlags feel technical and heavy. The architecture should support progressive depth, while the marketing starts with Launch Check.

## Report Hierarchy

A product can score well while its one essential transaction is broken.

**Report structure (score is last, not first):**

```
Almost ready

The main journey works, but two problems could stop new users.

  1 Blocker
  2 Important
  7 Polish

Release confidence: 74
```

The most important artifact should be the **release claim**, not a generalized quality number:

> "The first-value journey was completed successfully on desktop and mobile."

or:

> "FixFlags could not complete signup."

## The Flag as Durable Unit

Reports are containers. Prompts are delivery formats. Scores are summaries. The Flag is the durable unit.

**Every Flag connects:**

| Field | Purpose |
|-------|---------|
| Intended journey | What the user was trying to do |
| Observed behavior | What actually happened |
| Evidence | Screenshots, traces, network events |
| Consequence | Why it matters to a real user |
| Truth level | How confident FixFlags is (see truth system) |
| Expected behavior | What should have happened |
| Repair contract | Precise specification for the builder agent |
| Verification procedure | How to confirm the fix works |
| History | Previous states, dismissals, repairs |

A strong Flag survives tool changes because it expresses a product outcome rather than a vendor-specific instruction.

One Flag renders as: web report, Lovable prompt, Cursor task, Claude Code goal, GitHub issue, MCP response, pull-request check.

## Truth System

Every claim carries a truth class:

| Class | Meaning | Example |
|-------|---------|---------|
| Reproduced | FixFlags directly encountered the failure | "Created test account, submitted valid email, remained on /signup" |
| Detected | An objective rule failed | "Missing meta description on /pricing" |
| Observed | A product-quality concern was identified | "CTA button color has 2.1:1 contrast ratio" |
| Likely cause | An implementation explanation is inferred | "Auth redirect likely missing /onboarding callback" |
| Repository confirmed | Source location validated against code | "signup.tsx:47 missing navigate() after auth.success" |

This is not secondary metadata. It is central to making the brand credible.

## Dismissal Taxonomy

For every Flag, users choose:

| Response | Purpose | What it updates |
|----------|---------|----------------|
| Fix this | Standard repair flow | Nothing (repair begins) |
| Accept for now | Valid debt tracking | Project debt ledger |
| This is intentional | Updates the Product Contract | Product Contract intent |
| Incorrect finding | Improves precision | Flag quality model |
| Needs human review | Reveals automation limits | Automation confidence model |

False-positive suppression may become a stronger retention advantage than constantly adding more checks. The product learns from dismissals, not only fixes.

## Repair Specification vs Prompt

Tool-specific mega-prompts change as agents evolve. The underlying repair contract stays stable:

| Field | Purpose |
|-------|---------|
| Mission | What to accomplish |
| Context | Why it matters |
| Reproduction | How to trigger the failure |
| Evidence | What was observed |
| Expected behavior | What should happen instead |
| Constraints | Boundaries for the fix |
| Acceptance criteria | How to know it is done |
| Verification | How to confirm the fix works |

The prompt is a rendering layer. One Fix Specification becomes: Lovable paste, Cursor task, Claude Code goal, GitHub issue, MCP response, PR check.

This prevents FixFlags from becoming a prompt-generator whose value disappears as coding agents improve.

## Progressive Disclosure

Basic builders and engineers receive the same truth at different depths.

**Lovable user sees:**
> The signup button stops working after an invalid email. Paste this instruction into Lovable.

**Engineer sees:**
- Action trace
- Request and response
- Console event
- State transition
- Repository scope
- Regression test
- Verification procedure

The default report must be understandable by someone who has never opened a repository. Technical depth available without dominating.

## Complete Loop Before Paywall

The distinctive experience is not scan, score. PageSpeed, Lighthouse, accessibility scanners already provide diagnostics.

The distinctive experience is: **Flag, Fix, Re-check, Verified.**

**First-use boundary:**
- One anonymous teaser scan (scores, Flags, evidence; fix prompts stripped)
- Signup + claim unlocks fix prompts, prescription, re-check, and history
- Free account: 3 lifetime new URL checks (claimed teaser counts as 1)
- Account required for a second new URL or to preserve reports

This exposes differentiated value while limiting anonymous cost.

## Security Signal Discipline

Security anxiety is strong among Lovable users (Supabase, auth, payments, APIs, generated backend logic).

Do not casually present security as another rubric. A URL-only product cannot prove that an app is secure.

**It can detect:**
- Visible secrets
- Insecure browser behavior
- Public endpoint exposure
- Missing security headers
- Suspicious access behavior
- Obvious authentication and authorization failures

**It cannot provide** a comprehensive security guarantee without repository, configuration, infrastructure, authenticated roles, and controlled penetration testing.

**Language discipline:**
- Security signal found
- Access-control failure reproduced
- Configuration risk detected
- Security review recommended

**Never say:** "Your app is secure."

## Authenticated Testing Architecture

Public marketing pages are easy. Useful SaaS products require login, email verification, OTPs, magic links, test accounts, different roles, payment sandboxes, seeded data, destructive-action controls, third-party OAuth, CAPTCHAs.

### Staged model

**Initial:**
- User-provided test credentials
- Isolated test accounts
- No real payment execution
- Allowlisted actions
- Destructive actions disabled
- Visible activity record

**Later:**
- Reusable test personas
- Role-based journeys
- Test-data seeding
- Temporary inboxes
- Payment sandbox integration
- Secrets vault
- Environment-specific policies

The difference between "website audit" and "product verification" largely lives here. This is a core architecture problem, not a later setting.

## Change Awareness

Rerunning the whole product after every change is expensive, slow, and noisy.

Long-term retention depends on knowing:
- What changed
- Which journeys depend on it
- Which previously verified Flags could regress
- Which checks can be skipped
- What deserves a full audit

### Impact graph (eventual)

```
Route
  -> user journey
    -> UI component
      -> API call
        -> product contract
          -> prior Flags
            -> verification checks
```

URL-only FixFlags infers this weakly. Repository-connected FixFlags builds it more accurately.

**This is the path from:** "Run another audit." **To:** "This deployment changed signup and account settings. FixFlags rechecked those journeys and preserved the verified checkout state."

## Human-Assisted QA

The product does not need to pretend full autonomy from day one.

**Hybrid model for early Studio customers:**
1. Automated exploration
2. Deterministic checks
3. AI triage
4. Human review of the highest-risk Flags
5. Polished Fix Specifications
6. Automated re-check

**Benefits:**
1. Better paid outcomes immediately
2. A training set of corrected AI judgments
3. Insight into where full autonomy is safe

**Offer:**

> FixFlags Launch Review — $199-$750 depending on depth

For agencies, a higher-touch review can finance development and reveal what truly matters before automation is mature.

## Benchmark

The most important benchmark is not "issues found."

### Internal benchmark set

Contains:
- Polished apps with hidden functional failures
- Incomplete AI-generated SaaS products
- Lovable and Bolt apps
- Mobile-only problems
- Empty and error states
- Ambiguous product-judgment cases
- Intentional exceptions
- Authenticated role failures
- Known security signals
- Misleading but harmless patterns

### Per-benchmark definition

- Product intent
- Critical journeys
- Ground-truth failures
- Acceptable observations
- Prohibited false claims
- Verification conditions

### Metrics to track

- Blocker recall
- False-blocker rate
- Evidence correctness
- Journey completion accuracy
- Repair-specification usefulness
- Verified repair rate
- Regression detection
- Audit reproducibility

This benchmark becomes a hidden company asset and prevents demos from misleading us about actual quality.
