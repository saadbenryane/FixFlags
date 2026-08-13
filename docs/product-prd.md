# FixFlags product requirements

**Status:** Canonical product PRD (August 2026). Defines FixFlags as the continuous improvement system for software.

**Not in this document:** implementation phases, milestone ordering, or “what to build first.” Sequencing lives in [ROADMAP.md](../ROADMAP.md) and [knowledge/execution.md](../knowledge/execution.md). Shipped facts only: [PRODUCT.md](../PRODUCT.md).

**Workspace UI detail:** [workspace-interface.md](./workspace-interface.md) (chat left, browser right, playback bottom, Browser view ↔ Report view toggle, product review vs deep review browser modes, mobile parity).

---

## 1) Product vision

FixFlags is the continuous improvement system for software.

It independently experiences a Product, judges what deserves attention, prepares evidence-grounded Improvements for the customer’s builder, verifies the result through a fresh Review, and learns what good means for that Product.

The experience should feel familiar to users of Lovable and other AI builders:

- conversation on the left,
- the live product on the right,
- immediate visual feedback,
- visible progress,
- one continuous workspace from review to fix.

FixFlags does not build the product. It experiences the product independently.

North star and system layers: [knowledge/vision.md](../knowledge/vision.md).

---

## 2) Category and positioning

**Category:** Continuous product improvement.

**Tagline:** Finish what your AI started.

**Primary entry:**

- Headline: Finish what your AI started.
- Support line: Watch FixFlags use your product, find what is holding it back, and give your agent the next fix.
- Input: Paste your live product URL.
- Action: Review my product.

No scan type selection, agent configuration, project setup, or repository connection before first value.

**Competitive frame:**

| We are | We are not |
|--------|------------|
| An independent Product judgment and verification system | A generic analytics, QA, testing, or replay suite |
| URL-first product experience with replayable evidence | A Lighthouse-only score dump |
| Durable Improvements with builder handoff and verified outcomes | A PostHog clone or disconnected feature collection |

Direct peer war: Scout-class live product QA. CodeRabbit is adjacent (pre-merge code gate), not partner GTM.

Voice and banned phrases: [docs/voice-and-copy.md](./voice-and-copy.md), [lib/marketing/copy/terminology.ts](../lib/marketing/copy/terminology.ts).

---

## 3) Product statement and core loop

FixFlags is a live product-review workspace where users watch an AI product expert use their website, discuss what it sees, replay every important finding, send evidence-backed work to their builder, and verify that the product actually improved.

**Canonical loop:**

1. Observe
2. Understand
3. Judge
4. Improve
5. Verify
6. Learn

Customer shorthand: **Product Review → Fix → Verify → Watch**.

Product progression: **Look at my Product → Keep FixFlags watching → Connect more context**.

Each cycle improves both the customer product and FixFlags judgment quality.

---

## 4) Terminology (customer-facing)

Canonical source: `lib/marketing/copy/terminology.ts`.

| Customer term | Meaning |
|---------------|---------|
| Product | The long-lived customer object |
| Product review | One full pass on a URL: checks, report, fix prompts |
| Update review | Re-run on the same URL after fixes (uses product review credit) |
| Deep review | Journeys, funnel map, path playback with agent-class browsing |
| Funnel | Report section listing journeys |
| Path | Recorded journey unit for playback |
| Flag | Confirmed finding with evidence |
| Improvement | Durable Product-scoped judgment and worthwhile recommended action |
| Improvement Attempt | Builder handoff or declared implementation awaiting independent verification |
| Verification outcome | Improved, unchanged, regressed, or inconclusive result from a fresh Review |
| Product Signal | Privacy-bounded observed context that is not a Flag or causal claim by default |

**Banned in customer copy:** re-check, unlimited re-checks, new URL checks, journeys per month, polish pass/scan. Internal code may still use `re-check`, `audit`, `scan`, `monitoring`.

---

## 5) Pricing and metering (story)

Canonical numbers: `PRICING_COPY` in terminology.ts. Philosophy: [docs/business-model.md](./business-model.md).

| Plan | Price | Product reviews/mo | Deep reviews/mo |
|------|-------|------------------|-----------------|
| Free | $0 | 3 | 1 teaser |
| Pro | $69/mo | 25 | 4 |
| Studio | $199/mo | 80 | 10 |

**Rules:**

- Product reviews meter **new URLs and update reviews** from the same monthly pool.
- Deep reviews use a separate monthly allowance on paid plans.
- At product review limit, new runs pause until upgrade or cycle reset.
- Re-check is not free unlimited in customer language; implementation may lag marketing (see shipped gap table).
- Stripe IDs and enforcement: `lib/billing/plans.ts`, [PRODUCT.md](../PRODUCT.md).

**Paid add-ons (story):** before/after compare (Pro+), MCP (Pro+), share links and proof export (Studio).

---

## 6) Primary users

Founders and small teams using AI product-building tools:

- Lovable, Replit, Cursor, Claude Code, Codex, Bolt, and similar AI builders.

Initial wedge: Lovable users, with broad builder support from day one.

**Acquisition user:** Built with AI tools, about to share a link. Thought: “It works for me. What did I miss?”

**Recurring buyer:** Freelancer/agency shipping repeatedly, or small product team shipping weekly.

---

## 7) Entry and account model

- URL-first entry for anonymous users.
- Workspace opens immediately with honest progress (stages, partial Flags, capture placeholders).
- The progressive and completed Report, all confirmed Flags, screenshots, textual evidence, rubric results, and public-safe technology context remain visible while logged out.

Account unlock includes:

- all confirmed findings,
- saved evidence,
- fix preparation,
- update reviews (metered),
- report history,
- persistent product understanding.

Anonymous wedge: one teaser scan with the free programmatic Agent transcript and real Report evidence. Interactive chat, fix prompts, Timeline payloads, private history, Product Memory, update reviews, and Canvas stay gated. Public APIs must not leak those private fields.

Authentication flows land on `/post-login` so anonymous audits are claimed before checkout or `next` navigation.

---

## 8) Workspace interface (summary)

Full spec: [workspace-interface.md](./workspace-interface.md).

- **Left:** one Product-scoped FixFlags Agent transcript grounded in current Improvements, Review evidence, verification, Product Memory, and provenance.
- **Right:** dominant **Report** with authenticated **Timeline** and paid private **Canvas** modes.
- The left panel has no redundant title. Its right-aligned toolbar contains History followed by New scan.
- **Product review browser:** Playwright programmatic capture, screenshot-forward.
- **Deep review browser:** agent-class autonomous navigation (journeys, funnel, path recording).
- **Mobile:** Agent ↔ Report is the primary switch. Active reviews default to Agent and preserve the chosen tab through completion.

---

## 9) Workspace views (logical)

All share one Product, with a selected Review supplying observation context:

- **Live** — observe active review and ask questions.
- **Attention** — zero-to-three Improvements that deserve action now.
- **Report** — immutable observation and complete supporting evidence.
- **Improve** — prepare, export, and track builder attempts.
- **History** — Review, judgment, attempt, release, verification, outcome, and learning.

---

## 10) Starting a review

The workspace appears immediately after URL submission.

Visible stream and browser state stay synchronized to real scan/browser events, not synthetic narration.

---

## 11) Review engine

### Stage 1: instant checks

Objective signals: structure, metadata, links, headings, accessibility basics, loading behavior, responsive states, CTA visibility, forms, trust/security indicators, social and search signals.

### Stage 2: product understanding

Infer product type, audience, promise, primary action, key routes, critical journey. Ask for lightweight correction when confidence is limited.

### Stage 3: journey planning

Pick one high-value journey first, with viewport priorities and likely interaction points.

### Stage 4: targeted exploration

Use the product in-browser with deterministic steps, targeted model decisions, and explicit evidence capture.

**Product review:** programmatic Playwright steps dominate.

**Deep review:** agent-class browsing for multi-step journeys and funnel traversal.

### Stage 5: judgment

Fuse checks, behavior, intent, user corrections, prior knowledge, and false-positive signals into confirmed findings only.

Pipeline detail: [docs/audit-pipeline.md](./audit-pipeline.md).

---

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

---

## 13) Live activity stream

Translate observed actions into concise product-language updates.

Stream must be action-observable, not internal chain-of-thought.

---

## 14) User steering

Users can send short directives during review. The system acknowledges material scope shifts and continues with a new plan.

---

## 15) Browser control

Default mode is automated control.

User may take control to navigate, solve auth, dismiss blockers, or surface issues, then hand back control with continuation from current state.

---

## 16) Progress model

Show elapsed time and stage intent/coverage. Avoid false completion percentages.

Track completed/next stages and coverage counters.

---

## 17) Flag lifecycle

Observed → Investigating → Confirmed → accepted/challenged → fix prep → verification pending → resolved/unchanged/regressed.

Show only meaningful live states to the user.

---

## 18) Complete report

Reporting order:

1. Verdict on overall state.
2. What matters now (top impact first).
3. Full findings.
4. Coverage transparency: what was and was not reviewed.

No fixed finding cap in complete view.

Report contract: [knowledge/report-contract.md](../knowledge/report-contract.md).

---

## 19) Finding model

Required fields: flag type, rubric, severity, confidence, page, viewport, journey, goal, problem and observed behavior, why it matters, recommendation and agent task, definition of done, verification rule, related findings, current status.

A finding is valid only when evidenced and scoped.

---

## 20) Evidence experience

Selecting a finding shows synchronized explanation and browser evidence: screenshot, state and viewport, prior interaction, deterministic support, actions (Replay, Before, Current, Inspect).

Evidence must stand on its own.

---

## 21) Replay timeline and paths

Each review creates a sequence of structured events: action → observation → evidence → flag.

Timeline supports replay to state with evidence continuity.

**Funnel** lists journeys in the report. **Path** opens from Funnel or Flag evidence with bottom playback strip sync.

---

## 22) Update review and compare

- Update review is a primary header action on completed reports.
- Uses one product review credit (same pool as new URL).
- Pro **compare** shows before/after proof; diff strip on child reports (cleared / remaining / new).

Internal route `/re-check` may persist until API migration.

---

## 23) In-app chat policy

- Deterministic scan messages are always on, reconstructed from persisted audit facts, and consume no model tokens.
- Interactive chat requires the authenticated report owner and uses provider-configured chat separately from judge/triage.
- Monthly input-plus-output allowances are 25,000 on Free, 500,000 on Pro, and 2,000,000 on Studio.
- Allowance is reserved atomically before a model request and reconciled against provider-reported usage.
- Scope: Flag Q&A, steering, “what to fix first”, lightweight product corrections. Not general coding agent.
- Degrade to canned actions if provider unavailable.

---

## 24) Mobile parity

Full feature parity on phone: start review, Agent progress and chat, Report, Flag detail, evidence, authenticated Timeline, update review and diff, account, billing, and paid Canvas.

Agent ↔ Report is the primary view switch.

---

## 25) FixFlags intelligence

### Product Passport (per product)

Private memory: purpose, audience, priorities, open and resolved findings, accepted corrections, protected behaviors, verification history.

### Global Flag Library

De-identified cross-product pattern store with context, risk, evidence requirements, typical severity, fix outcomes, regression risks.

### Regression Evaluation Set

Quality gate for deterministic checks, flags, ranking, prompts, and verification behavior changes.

Detail: [knowledge/vision.md](../knowledge/vision.md), [knowledge/product.md](../knowledge/product.md).

---

## 26) Knowledge learning pipeline

Observed findings enter global patterns only when repeated and verified, not on private assumptions or unresolved signals.

No hardcoded per-customer exceptions.

---

## 27) Cross-product privacy

Global learning uses de-identified, non-sensitive signals only.

Retention controls for deletion, auth state, repository links, and revocation.

No private model training/fine-tuning without explicit permission.

See [knowledge/privacy.md](../knowledge/privacy.md), [SECURITY.md](../SECURITY.md).

---

## 28) Context for development agents

Agent context should be task-specific and minimal.

Each task receives: goal, evidence, affected journey, priority, constraints, protected behaviors, and verification link.

---

## 29) Integration levels

1. Copyable tasks (Lovable, Claude Code, Cursor, Codex, Replit)
2. Knowledge export (tooling- and rules-file compatible context)
3. FixFlags MCP (product brief, coverage, findings, history)
4. Repo/preview integrations (when authenticated)
5. Closed-loop verify after deployment (not required for first public beta)

---

## 30) Fixes view

Group related findings into one coherent change path when possible.

Primary action remains first-class; secondary options do not compete.

---

## 31) Verification loop

After fix prep: state “Waiting for updated product”; action “Verify now” (update review).

Targeted re-check verifies affected flow, related findings, protected behaviors, regressions, and returns deterministic outcomes.

---

## 32) Verification receipt

Structured outcome record: original evidence, reviewed version, actions, before/after, protected checks, result, unresolved concerns, timestamp.

Outcomes: resolved, partially resolved, unchanged, regressed, unable to verify.

---

## 33) Product history

History is continuity of improvement over time, not just a pile of reports.

---

## 34) Persistent review conversation

Conversation remains available after report to answer follow-up questions tied to evidence and history. No blank general chat mode.

---

## 35) Runtime architecture (requirements)

**Persistent state:** product config, passport, reports, findings, screenshots, evidence, timeline, re-check receipts, auth flags when authorized.

**Ephemeral compute:** isolated workers for checks, browser sessions, narration/judgment, replays, synthesis, re-checks. Workers terminate after completion or inactivity.

Architecture detail: [ARCHITECTURE.md](../ARCHITECTURE.md).

---

## 36) Security requirements

Session isolation, bounded network, explicit auth consent, easy revocation, cleanup, safe file/content handling.

No autonomous sensitive actions by default.

---

## 37) Cost strategy

- cheap deterministic checks first,
- targeted model use,
- strong model only for judgment and ambiguity,
- reuse captured evidence,
- targeted verification,
- bounded context per model call,
- cheap chat model separate from judge pipeline.

---

## 38) Visual design (product)

- calm and evidence-led,
- warm white palette and neutral browser frame,
- orange for active focus and primary actions,
- red reserved for real blockers or regressions.

Motion only for causal cause-and-effect feedback.

Tokens: [DESIGN.md](../DESIGN.md).

---

## 39) Product states

Ready, Reviewing, Needs guidance, User control, Review complete, Report unlocked, Fix prepared, Verifying, Improved, Protected.

---

## 40) Primary and supporting metrics

**Primary:** verified meaningful improvements per active Product.

**Supporting:** review activation and completion, report open + evidence replay + fix preparation, takeover usage, fix export and verification completion, resolved findings and return retention.

---

## 41) Quality measures

Precision, false-positive handling, duplicate suppression, evidence completeness, severity calibration, ranking quality, re-check consistency, regression detection, resolved-return behavior.

---

## 42) Release acceptance criteria

- event-grounded narration,
- evidence-backed confirmed findings,
- explicit coverage and non-tested gaps,
- coherent fix tasks,
- repeatable verification states,
- stable findings across unchanged scans,
- complete loop available on desktop/mobile,
- meaningful value without pre-review setup.

---

## 43) Shipped vs target (facts)

Canonical interface table: [docs/workspace-interface.md](../docs/workspace-interface.md) (Shipped vs target).

| Area | Shipped today | Target |
|------|---------------|--------|
| Workspace layout | Unified Agent left; Report, authenticated Timeline, and paid Canvas right | Same |
| Browser in UI | Authenticated Timeline screenshot replay and step scrub | Agent-class deep-review live browser |
| In-app chat | Owner-only model chat plus free deterministic scan messages; monthly usage ledger | Same |
| Product review capture | Playwright programmatic with workspace sync | Same |
| Deep review | Journey capture in pipeline; funnel + path playback in workspace | Agent-class browser mode in workspace panel |
| Customer metering | Product review + deep review quotas enforced in `lib/billing/plans.ts` and `lib/audit/usage.ts` | Same |
| Update review billing | Metered product review credits; internal route `/re-check` | Public API rename to update-review (open) |
| Pricing display | $69 / $199 in marketing and Stripe plans | Same |
| Funnel + path UI | Funnel section + Replay path into workspace | Full session-style takeover replay |
| Mobile | Agent ↔ Report tabs; authenticated adapted playback | Full-screen path replay |
| Compare | Pro before/after compare after update review | Primary payoff surface |

Shipped truth detail: [PRODUCT.md](../PRODUCT.md).

---

## 44) Open questions

1. When should full-screen Timeline playback be evaluated beyond the shipped adapted inline layout?
2. When should browser takeover be considered after the Agent-led report workspace has production evidence?
3. When should the public API migrate from `re-check` naming to `update-review`?

---

## 45) Why this direction can win

AI builders get review continuity and proof that cannot be produced inside the editor itself: independent judgment + replayable evidence + verified outcome.

---

## 46) Final experience

URL input opens workspace, review runs live, findings evolve from observation into confirmed evidence-backed recommendations, the best issue becomes clear, fixes are prepared and exported, and verification confirms improvement.

The outcome is a continuous, evidence-first improvement story.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-01 | Canonical merge: live-review PRD, product-ui-intent, Product QA positioning, workspace interface spec. Removed implementation phases from PRD body. |
