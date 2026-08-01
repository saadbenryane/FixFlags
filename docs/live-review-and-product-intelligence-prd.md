# FixFlags Live Review and Product Intelligence

**Final Product Requirements Document**

**Date:** July 29, 2026

**Status:** Product direction approved. UI intent locked August 2026 ([product-ui-intent.md](./product-ui-intent.md)). Implementation not started.

## 1) Product vision

FixFlags is a live product-review workspace where founders watch an independent AI product expert use their website, ask questions, inspect evidence, prepare fixes for their builder, and verify that the product improved.

The experience should feel familiar to users of Lovable and other AI builders:

- conversation on the left,
- the live product on the right,
- immediate visual feedback,
- visible progress,
- one continuous workspace from review to fix.

FixFlags does not build the product. It experiences the product independently.

## 2) Product statement

FixFlags is a live product-review workspace where users watch an AI product expert use their website, discuss what it sees, replay every important finding, send evidence-backed work to their builder, and verify that the product actually improved.

Core loop:

- Build
- Review
- Fix
- Verify
- Learn

Each cycle improves both the customer product and FixFlags judgment quality.

## 3) Core product promise

Paste a URL.

FixFlags will:

- understand the product,
- inspect objective signals,
- browse key journeys like a first-time visitor,
- explain what it is checking,
- capture evidence,
- confirm real problems,
- produce a complete prioritized report for declared coverage,
- prepare grounded work for the user's agent,
- verify the resulting changes,
- remember what was learned.

The user should feel in review with an expert, not waiting for a dead report.

## 4) Positioning and homepage

Primary entry:

- Headline: Finish what your AI started.
- Support line: Watch FixFlags use your product, find what is holding it back, and give your agent the next fix.
- Input: Paste your live product URL
- Action: Review my product

No scan type selection, agent configuration, project setup, or repository connection before first value.

## 5) Primary users

Founders and small teams using AI product-building tools:

- Lovable
- Replit
- Cursor
- Claude Code
- Codex
- Bolt
- similar AI builders

Initial wedge: Lovable users, with broad builder support from day one.

## 6) Complete product loop

1. **Understand**: infer purpose, audience, likely journeys, priority goals.
2. **Review**: deterministic checks + selected browser exploration.
3. **Report**: confirmed findings across full declared coverage.
4. **Fix**: convert findings into one or more coherent task units.
5. **Verify**: re-check focused coverage and protected behavior.
6. **Learn**: persist verified outcomes in Product Passport and global intelligence.

## 7) Entry and account model

- URL-first entry for anonymous users.
- workspace opens immediately and shows review progress.
- full report and complete controls unlock after account creation.

Account unlock includes:

- all confirmed findings,
- saved evidence,
- fix preparation,
- re-checks,
- report history,
- persistent product understanding,
- three free complete reviews.

The first completed review consumes one free review. No partial findings are a paid gate.

## 8) Main workspace

Desktop layout:

- **Left panel**: title, elapsed time, activity stream, conversation, findings, progress, user input.
- **Right panel**: live product browser with navigation controls, URL, viewports, action highlights, pause/take control, replay evidence.

The browser stays visually dominant.

### Locked UI decisions (August 2026)

Founder-approved interface intent (full detail: [product-ui-intent.md](./product-ui-intent.md)):

- **Feel:** live session + sharp report + fix loop at once.
- **Desktop live:** split chat/activity left, browser right; evolve today’s report shell rather than replace it.
- **After complete:** Fix list primary, evidence always provable.
- **Entry:** workspace opens immediately on URL submit.
- **Funnel/paths:** same report; path = full session replay in browser panel.
- **Update review:** primary header action; Pro compare as proof.
- **Chat:** always on in-app; cheap OpenRouter-class model for conversation (not judge pipeline).
- **Mobile:** full feature parity; Lovable-style Chat ↔ Product switching.
- **Next milestone:** live workspace first.

## 9) Workspace views

- **Live**: observe active review and ask questions.
- **Report**: see prioritized verdict and complete results.
- **Fixes**: prepare, export, and track builder work.
- **History**: compare versions and outcomes across reviews.

All views share the same review record.

## 10) Starting a review

The workspace appears immediately after URL submission.

Visible stream and browser state should stay synchronized to real scan/browser events, not synthetic narration.

## 11) Review engine

### Stage 1: instant checks

Objective signals:

- structure, metadata, links, headings
- accessibility basics
- loading behavior
- responsive states
- CTA visibility and interaction points
- forms and trust/security indicators
- social and search signals

### Stage 2: product understanding

Infer product type, audience, promise, primary action, key routes, critical journey.

Ask for a lightweight correction when confidence is limited.

### Stage 3: journey planning

Pick one high-value journey first, with viewport priorities and likely interaction points.

### Stage 4: targeted exploration

Use the product in-browser with deterministic steps, targeted model decisions, and explicit evidence capture.

### Stage 5: judgment

Fuse checks, behavior, intent, user corrections, prior knowledge, and false-positive signals into confirmed findings only.

## 12) Review boundaries

Initial coverage:

- homepage,
- primary CTA,
- one critical journey,
- desktop and mobile,
- Message, Experience, Reach rubrics,
- public states by default,
- authenticated states only via user takeover.

Do not claim untested scope.

## 13) Live activity stream

Translate observed actions into concise product-language updates.

Stream must be action-observable, not internal chain-of-thought.

## 14) User steering

Users can send short directives during review. The system should acknowledge material scope shifts and continue with a new plan.

## 15) Browser control

Default mode is automated control.

User may take control to navigate, solve auth, dismiss blockers, or surface issues, then hand back control with continuation from current state.

## 16) Progress model

Show elapsed time and stage intent/coverage. Avoid false completion percentages.

Track completed/next stages and coverage counters.

## 17) Flag lifecycle

Observed -> Investigating -> Confirmed -> accepted/challenged -> fix prep -> verification pending -> resolved/unchanged/regressed.

Show only meaningful live states to the user.

## 18) Complete report

Reporting order:

1. Verdict on overall state.
2. What matters now (top impact first).
3. Full findings.
4. Coverage transparency: what was and was not reviewed.

No fixed finding cap in complete view.

## 19) Finding model

Required fields:

- flag type, rubric, severity, confidence
- page, viewport, journey, goal
- problem and observed behavior
- why it matters
- recommendation and agent task
- definition of done
- verification rule
- related findings
- current status

A finding is valid only when evidenced and scoped.

## 20) Evidence experience

Selecting a finding should show synchronized explanation and browser evidence:

- screenshot,
- state and viewport,
- prior interaction,
- deterministic support,
- actions: Replay, Before, Current, Inspect.

Evidence must stand on its own.

## 21) Replay timeline

Each review creates a sequence of structured events:

- action -> observation -> evidence -> flag.

Timeline should support replay to state with evidence continuity.

## 22) FixFlags intelligence

### Product Passport (per product)

Private memory includes purpose, audience, priorities, open and resolved findings, accepted corrections, protected behaviors, and verification history.

### Global Flag Library

De-identified cross-product pattern store with context, risk, evidence requirements, typical severity, fix outcomes, and regression risks.

### Regression Evaluation Set

Quality gate for deterministic checks, flags, ranking, prompts, and verification behavior changes.

## 23) Knowledge learning pipeline

Observed findings only enter global patterns when repeated and verified, not on private assumptions or unresolved signals.

No hardcoded per-customer exceptions.

## 24) Cross-product privacy

Global learning uses de-identified, non-sensitive signals only.

Retain controls for retention, deletion, auth state, repository links, and revocation.

No private model training/fine-tuning without explicit permission.

## 25) Context for development agents

Agent context should be task-specific and minimal.

Each task receives: goal, evidence, affected journey, priority, constraints, protected behaviors, and verification link.

## 26) Integration levels

1. Copyable tasks (Lovable, Claude Code, Cursor, Codex, Replit, Copy task)
2. Knowledge export (tooling- and rules-file compatible context)
3. FixFlags MCP (product brief, coverage, findings, history)
4. Repo/preview integrations (when authenticated)
5. Closed-loop verify after deployment (not required for v1)

## 27) Fixes view

Group related findings into one coherent change path when possible.

Primary action remains first-class; secondary options do not compete.

## 28) Verification loop

After fix prep:

- state: Waiting for updated product
- action: Verify now

Targeted re-check verifies affected flow, related findings, protected behaviors, regressions, and returns deterministic outcomes.

## 29) Verification receipt

Store structured outcome record including original evidence, reviewed version, actions, before/after, protected checks, result, unresolved concerns, and timestamp.

Allowed outcomes:

- resolved
- partially resolved
- unchanged
- regressed
- unable to verify

## 30) Product history

History is continuity of improvement over time, not just a pile of reports.

## 31) Persistent review conversation

Conversation remains available after report to answer follow-up questions tied to evidence and history.

No blank general chat mode.

## 32) Runtime architecture

### Persistent state

- product config, passport, reports, findings, screenshots, evidence, timeline, re-check receipts, auth flags when authorized.

### Ephemeral compute

Isolated workers for checks, browser sessions, narration/judgment, replays, synthesis, re-checks.

Workers terminate after completion or inactivity.

## 33) Core system components

- review orchestrator,
- deterministic scanner,
- browser worker,
- judgment layer,
- evidence service,
- report service,
- product intelligence service,
- flag intelligence service,
- evaluation service,
- integration gateway,
- verification engine.

## 34) Security requirements

Session isolation, bounded network, explicit auth consent, easy revocation, cleanup, safe file/content handling.

No autonomous sensitive actions by default.

## 35) Cost strategy

- cheap deterministic checks first,
- targeted model use,
- strong model only for judgment and ambiguity,
- reuse captured evidence,
- targeted verification,
- bounded context per model call.

## 36) Visual design

- calm and evidence-led,
- warm white palette and neutral browser frame,
- orange for active focus and primary actions,
- red reserved for real blockers or regressions.

Motion only for causal cause-and-effect feedback.

## 37) Responsive experience

Desktop: resizable split.

Mobile: two tabs (`Review`, `Product`) with inline evidence previews for references.

## 38) Product states

Ready, Reviewing, Needs guidance, User control, Review complete, Report unlocked, Fix prepared, Verifying, Improved, Protected.

## 39) Minimum viable release

Deliver the full value loop for Live Review without becoming a general autonomous computer:

- URL-first
- two-panel workspace
- Playwright browser
- deterministic checks
- critical-journey coverage
- desktop + mobile
- event-based stream
- steering + takeover
- synchronized evidence
- complete findings in scope
- one builder-ready task
- targeted re-check
- verification receipt
- basic history

## 40) Primary and supporting metrics

Primary:

- verified improvements per active product.

Supporting:

- review activation and completion,
- report open + evidence replay + fix preparation,
- takeover usage,
- fix export and verification completion,
- resolved findings and return retention.

## 41) Quality measures

Precision, false-positive handling, duplicate suppression, evidence completeness, severity calibration, ranking quality, re-check consistency, regression detection, and resolved-return behavior.

## 44) Release acceptance criteria

Requirements for public beta readiness:

- event-grounded narration,
- evidence-backed confirmed findings,
- explicit coverage and non-tested gaps,
- coherent fix tasks,
- repeatable verification states,
- stable findings across unchanged scans,
- complete loop available on desktop/mobile,
- meaningful value without pre-review setup.

## 45) Why this direction can win

AI builders get review continuity and proof that cannot be produced inside the editor itself: independent judgment + replayable evidence + verified outcome.

## 46) Final experience

URL input opens workspace, review runs live, findings evolve from observation into confirmed evidence-backed recommendations, the best issue becomes clear, fixes are prepared and exported, and verification confirms improvement.

The outcome is a continuous, evidence-first improvement story.
