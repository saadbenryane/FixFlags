# Product System

**Canonical home for the three FixFlags products: Quick Check, Finish Check, and Watch.** Shipped facts: [PRODUCT.md](../PRODUCT.md). Vision: [vision.md](./vision.md).

## Core loop

**Check → Fix → Verify → Watch**

The unit of value is not a scan, score, report, or issue. The unit of value is a verified fix.

The customer loop above is the wedge expression of the canonical loop **Signal → Understand → Prioritize → Fix → Verify → Learn** ([vision.md](./vision.md)).

## One intelligence, multiple surfaces

Quick Check / Finish Check / Watch are the shipped product surfaces of one intelligence system. Audience packaging (Builders / Developers / Companies) is the same intelligence through different surfaces — never three disconnected products. See [vision.md](./vision.md) → Product packaging.

## Three products

### A. Quick Check

The free acquisition product.

**User promise:** See what you missed.

**Input:** A public or staging URL. No account required before first evidence appears.

**What Quick Check does:**
- Reads the page and likely product purpose
- Finds the main public routes
- Builds a route and action map
- Checks internal links and redirects
- Checks visible buttons and forms
- Reviews desktop and mobile
- Captures console and network failures
- Runs accessibility, metadata and performance checks
- Identifies the likely primary action
- Produces up to three prioritized Flags

**What Quick Check does not do:**
- Authenticated navigation
- Full application exploration
- Multiple user roles
- Real checkout
- Destructive actions
- Claims about actual customer behavior
- Complete security review

**Free result (before signup):**
- The checked URL
- Routes and actions checked
- Devices checked
- One full high-confidence Flag with complete evidence
- Two additional Flag titles
- A clear statement of the checked scope

Then offer: **Save the Finish Plan**

**After free account creation:**
- All three Flags
- Fix prompts
- One re-check
- Report history for that product

**Success moment:** The user thinks "I did not notice that." Not "This generated a lot of recommendations."

### B. Finish Check

The one-time paid product.

**User promise:** Test what customers came to do.

**Price:** $49 one-time (hypothesis to test against $29 and $79 variants).

**Purchase moment:** After the free result.

> Now test the paths that matter. Run three important journeys on desktop and mobile, get complete evidence, and re-check every fix for seven days.

**Setup — the customer confirms:**
- What the product does
- Who it serves
- The most important action
- Up to three journeys
- The success condition for each journey
- Whether a test account is required
- Areas FixFlags must not access
- Allowed and forbidden actions

**Example journeys:**
- Create an account
- Sign in
- Complete onboarding
- Create the first project
- Book an appointment
- Submit a lead form
- Add an item and reach test checkout
- Invite a test teammate
- Generate a report
- Recover from an error

**Finish Check output:**
- Journey results (Passed / Passed with friction / Blocked / Could not verify)
- Complete evidence (replay, screenshots, route, browser and viewport, actions attempted, console and network events, success assertion, reproduction steps)
- Finish Plan (ranked list of what to address first)
- Builder-ready fix (copy prompt, open in builder, send through MCP, create GitHub issue, draft pull request when repo access exists)
- Seven-day verification window (re-run same journeys after each fix; same environment, viewport, task, success assertion)

### C. Watch

The recurring product.

**User promise:** Know when an important path breaks.

**Trigger:** A production or preview deployment.

**Watch remembers:**
- Product purpose
- Important journeys
- Success assertions
- Routes involved
- Test accounts
- Accepted Flags
- Dismissed suggestions
- Verified fixes
- Previous evidence
- Known unstable third-party dependencies

**After a deployment, FixFlags:**
1. Reads the deployment and repository change
2. Determines which routes and journeys may be affected
3. Runs deterministic checks on changed surfaces
4. Re-runs affected saved journeys
5. Compares the new result with the previous verified result
6. Reports only new, reopened or materially changed Flags

**Alert language:**
- Avoid: "Your quality score dropped six points."
- Use: "Account creation stopped completing on mobile after this deployment."

**Watch outputs:**
- Passed deployment
- Confirmed regression
- Changed behavior requiring review
- Could not verify
- New heuristic suggestion

**Notification surfaces:**
- Email
- GitHub
- Slack (later)
- Builder through MCP
- FixFlags dashboard

## Activation and paywall design

### Before signup
Show enough to establish trust: what was checked, one complete finding, evidence, why it matters.

### Free-account gate
Ask the user to create an account to: see all Flags, copy the fix prompt, save the report, re-check the result.

### Paid gate
Ask for payment when the user wants: authenticated testing, multiple journeys, replay, mobile and desktop journey checks, seven-day verification, continuous monitoring.

Do not charge merely to reveal generic audit findings.

### Natural upgrade copy

After Quick Check:
> **Now test what customers came to do.**
> Run three important journeys and verify every fix for $49.

After Finish Check:
> **Keep these paths checked after every deploy.**
> Turn on Watch for $39 per month.

## Priority tiers

| Priority | Product | Must include |
|----------|---------|-------------|
| P0 | Conversion-ready Quick Check | Public URL submission, route discovery, link and action checks, desktop and mobile, console and network capture, metadata/a11y/performance checks, evidence-backed Flags, confidence levels, scope and coverage, one full result before signup, account creation, fix prompt, re-check, private report, payment for Finish Check |
| P1 | Goal-based Finish Check | Product-purpose confirmation, goal selection, journey policy, explicit success assertions, bounded agent runner, replay, complete evidence, three journeys, mobile and desktop, seven-day re-checking, before-and-after verification |
| P2 | Authenticated journeys | Encrypted test credentials, reusable isolated auth state, test inbox, safe data reset, role support, credential revocation, detailed audit log |
| P3 | Watch | GitHub connection, deployment trigger, change mapping, saved journeys, affected-journey selection, regression detection, alerts, history |
| P4 | Studio workflow | Multiple products, client links, shared comments, branded exports, project templates, team roles, handoff summary |
| P5 | Real-user evidence | Sentry connector, PostHog connector, FullStory connector, evidence correlation, clear separation between simulated/observed/real-user evidence |

## What we will not build first

- Native mobile testing
- Enterprise test management
- A full analytics suite
- Session recording infrastructure
- Security certification
- Penetration testing
- A large persona library
- Multi-agent swarms
- Automated production payments
- Automated destructive actions
- Arbitrary product-quality scores
- A roadmap-writing AI product manager
- An AI coding environment
- A standalone source-code scanner
- Hundreds of integrations
- A public roast database without customer consent
