# User Journey

**Canonical home for FixFlags personas, core user journey, and conversion architecture.** Product system: [product-system.md](./product-system.md). Pricing: [strategy.md](./strategy.md).

## Personas

### Acquisition user: The AI builder preparing to share something real

They built with Lovable, Cursor, Replit, Bolt, Claude Code, Codex, Windsurf, v0 or a combination of tools. They may be a solo founder, product manager building an MVP, designer who now ships code, developer building a side product, or freelancer preparing a client handoff.

Their thought: "It works for me. What did I miss?"

They arrive through Product Hunt, social media, search, builder communities or a shared FixFlags result.

### One-time buyer: The builder approaching a launch, handoff or campaign

They are about to launch on Product Hunt, share publicly, start outreach, spend on acquisition, deliver work to a client, or invite the first real users.

They buy a Finish Check.

### Primary recurring buyer: The freelancer or small agency shipping repeatedly

Their money problem: manual review reduces margins, handoff problems damage trust, client-reported bugs create unplanned work, each project is built slightly differently, they need consistent evidence across projects.

They buy Studio.

### Secondary recurring buyer: The small product team shipping weekly

They need to know whether a deployment broke signup, checkout, onboarding, the core action, or an important client workflow.

They buy Watch through Pro or Team plans.

### Not the initial customer

FixFlags will not initially serve: enterprise QA departments, native mobile applications, complete test-suite replacement, regulated compliance certification, deep penetration testing, large internal enterprise systems, products requiring real-money transactions in tests, teams expecting guaranteed conversion improvement.

## Core user journey

### 1. Land
The user immediately sees "Finish what your AI started." FixFlags tests the paths that matter, shows exactly where they fail, and gives your AI the fix. The URL field is the dominant interaction.

### 2. Paste
The user enters a public URL. No signup wall appears.

### 3. Watch useful progress
Show concrete progress: mapping the public product, checking links and actions, testing mobile, looking for failed requests, reviewing the primary action. Avoid fake percentages and theatrical agent narration.

### 4. Reach the proof moment
The first result should be a specific finding: "The signup button gives no visible response on mobile." This is far more persuasive than a score.

### 5. Create an account
The user signs up to save all Flags, receive the fix prompt and re-check.

### 6. Take action
The primary report CTA is: **Fix this**. The user chooses: copy prompt, open in builder, send through MCP, create issue.

### 7. Verify
The report waits for the new deployment. Then: "Fixed. Account creation now completes on mobile. Verified against the same journey."

### 8. Expand
The next offer: "Test a complete customer journey." This leads to the paid Finish Check.

### 9. Retain
After the paid check: "Keep these journeys checked after every deploy." This leads to Watch.

## Conversion architecture

### Homepage structure

1. **Hero** — "Finish what your AI started." URL field is dominant. No signup to start, private by default.
2. **Proof moment** — Short real replay: "We gave FixFlags one job: create an account. The button did nothing on mobile." Show replay, evidence, fix, verified result.
3. **Sample Finish Plan** — Lead with "1 blocker found" not "70/100 release readiness."
4. **Three-step loop** — Check (test the live product), Fix (send evidence and fix to your AI), Verify (run the same path again).
5. **Use cases** — Launching (check before people arrive), Shipping (check after product changes), Client work (show what was tested before handoff).
6. **Builder integrations** — Show recognizable builder names without claiming native integrations that do not exist.
7. **Pricing** — Lead with the one-time Finish Check. Subscriptions are for repeat use.
8. **Trust** — Private by default, test scope, evidence levels, safe action policy, no false guarantees.
9. **Final CTA** — "Check my product"

### Copy rules

**Use:** Check, Path, Task, Blocked, Evidence, Fix, Verified, Changed.

**Avoid leading with:** Release readiness, Quality layer, Comprehensive audit, Product intelligence platform, Synthetic users, Autonomous QA, 150+ checks, AI-powered insights, Ship with confidence repeated everywhere.

### Positioning

**Tagline:** Finish what your AI started.

**Homepage explanation:** FixFlags tests the paths that matter, shows exactly where they fail, and gives your AI the fix.

**Supporting line:** Paste your live URL. See what needs attention before customers, clients or traffic reach it.

**Primary CTA:** Check my product

**Input placeholder:** Paste your live URL

**Trust line:** No signup to start · Private by default · First result in about a minute

**Product category:** Use "AI product review" in explanatory copy. Use the following for search and intent pages: AI website QA, AI app testing, Vibe-coded app testing, Website quality check, Pre-launch website check, Lovable app testing, Replit app testing, Cursor app review. Do not force those terms into the hero.

## Required changes in the current product

### Keep
- "Finish what your AI started."
- Instant URL entry
- No signup before initial value
- Private reports
- Screenshots and evidence
- Message, Experience and Reach
- Fix prompts
- MCP
- Re-check
- Builder compatibility
- Premium visual brand

### Remove or rewrite
- "Release readiness layer"
- "AI gets you 80%. FixFlags gets you to 100%."
- "Complete audit"
- "Every dimension of release readiness"
- "Trained on real product standards" until substantiated
- Arbitrary readiness scores as the primary result
- Check counts as the primary proof of value
- Repeated "ship with confidence" language
- "Your users will…" when only an AI agent was tested
- Pricing based primarily on new URL checks

### Replace the current hero with
> Finish what your AI started.
> FixFlags tests the paths that matter, shows exactly where they fail, and gives your AI the fix.
> [Paste your live URL] [Check my product]
> No signup to start · Private by default

### Replace the report header with
> Fix these before you share it
> 1 blocker found in the paths we tested

### Replace the score with
Goal outcomes, Blockers, Observed friction, Checked scope.

### Replace "Start your audit" with
Check your product

### Replace "We run a complete audit" with
We check the live product

### Replace "Get fixes. Ship." with
Fix it. Check again.
