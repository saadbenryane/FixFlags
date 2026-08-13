# Post-Launch Experiments

*Designed for the period after Game On launch-complete ships to production and the funnel has signal (anonymous scans, claims, re-checks, and Watch enrollments flowing through the live workspace). Three experiments, ranked by leverage to the core Product Review → Fix → Verify → Watch loop and the canonical SIGNAL → UNDERSTAND → PRIORITIZE → FIX → VERIFY → LEARN cycle (vision.md). All experiments follow the protocol in `.agents/company/ceo.md` — termination states: **adopt / iterate / reject / inconclusive**.*

---

## Ranking rationale

Experiments are ordered by how fundamental they are to the product thesis. If the Verify step does not happen, there is no learning, no proof, and no loop. If Watch does not catch real regressions, the monetization engine has no value. If Funnel-first presentation does not improve fix action, our prioritization is decoration, not utility.

---

## Experiment 1 — Update Review (Re-check) Loop Closure

**Maps to canonical loop:** VERIFY → LEARN.
**Improves understanding of:** whether deployed fixes actually improved the product (vision.md: "Verify precedes confidence", "Fix and verify in the same loop").

### Hypothesis
Surfacing re-check as an explicit "Did your fix work?" step with before/after evidence comparison increases the rate at which users return to verify their fixes within 7 days of their first review.

### Signal / metric
**Re-check initiation rate** = (# users who run an update review within 7 days of receiving a first review that contained ≥1 fixable Flag) / (# users who received such a first review).

Secondary: **Verified-fix rate** = (# re-checked reviews where ≥1 previously-unresolved Flag became resolved or improved) / (# re-checked reviews).

Target sample: 200 first reviews → ~50 expected re-checks at 25% rate.

### Decision threshold
- Re-check initiation rate ≥ 25% (baseline estimated ~10–15% from similar verification-loop products).
- Verified-fix rate ≥ 50% among re-check initiators.
- Both thresholds must be met simultaneously to count as "adopt."

### Termination states (per ceo.md protocol)
| State | Evidence that triggers it |
|-------|--------------------------|
| **adopt** | Initiation rate ≥25% AND verified-fix rate ≥50%. The loop closes; users return and see proof their fixes worked. Promote re-check affordance to primary post-fix CTA. |
| **iterate** | Initiation rate 15–25% (users return but need stronger incentive or clearer before/after evidence). Refine follow-up email timing, fix-prompt quality, or before/after diff UI. |
| **reject** | Initiation rate <15%. Users do not return to verify; the loop is broken. Re-examine whether the problem is the prompt text, the claim step, or the value proposition of verification itself. |
| **inconclusive** | Initiation rate 15–25% but <20 re-checks collected (insufficient volume to judge verified-fix rate). Extend collection window by 2 weeks. |

### Owner
CEO (Product). Research executive owns hypothesis and signal design; Growth owner runs follow-up cadence.

### Budget posture
**Free-first.** Re-check infra (Playwright re-scan, snapshot diff, deterministic Agent messages) is already shipped. Judge triage uses free-tier models by default; escalation to paid only if free-tier capacity is exhausted (requires CEO approval per `executives.md`). No external spend.

### Prerequisite signal
50+ completed first product reviews where ≥1 fixable Flag was delivered and fix-completion status is tracked. (Without this baseline, there is no population to re-check.)

---

## Experiment 2 — Watch Regression Detection

**Maps to canonical loop:** SIGNAL (continuous).
**Improves understanding of:** ongoing product health and drift between deployments (vision.md: "what got worse", "products connected for ongoing monitoring").

### Hypothesis
Automated Watch re-scans surface regression Flags (issues that emerged after the initial review) that users act on at a materially higher rate than scan-only Flags, proving continuous monitoring catches drift the one-off review missed.

### Signal / metric
**Regression Flag rate** = (# regression Flags discovered per watched product per week) = (# Flags in Watch re-scan that were absent in the last review) / (# watched products × weeks observed).

Secondary: **Watch regression action rate** = (# regression Flags marked as acted-on / in-progress within 48h) / (# regression Flags discovered).

Target sample: 20 watched products observed for ≥2 weeks → ≥40 regression Flags expected at 1/week.

### Decision threshold
- Regression Flag rate ≥ 1 per watched product per week.
- Watch regression action rate ≥ 60% within 48h.
- Both must be met to count as "adopt."

### Termination states (per ceo.md protocol)
| State | Evidence that triggers it |
|-------|--------------------------|
| **adopt** | Regression rate ≥1/week AND action rate ≥60%. Watch delivers real, actionable drift detection. Expand Watch to all Pro/Studio and add push notifications. |
| **iterate** | Regression rate ≥0.5/week but action rate <60% (users see regressions but don't act — delivery or prompt quality issue). Improve regression Flag scoping or notification timing. |
| **reject** | Regression rate <0.5/week. Watch catches noise, not real drift. Re-evaluate what constitutes a regression; tighten detection or kill the feature. |
| **inconclusive** | Regression rate 0.5–1/week but user feedback is split (qualitative signal contradicts metric) OR <10 watched products with full 2-week observation. Extend the observation window. |

### Owner
CEO (Product). Product exec owns Watch feature behavior; Research exec owns hypothesis and termination adjudication.

### Budget posture
**Free-first.** Watch re-scans use the existing Playwright capture pipeline (deterministic). Judge triage defaults to free-tier models. Paid escalation requires CEO approval per `executives.md`. No external spend beyond standard infra.

### Prerequisite signal
20+ claimed products with Watch enabled and a baseline scan complete. (Without Watch adoption, there is no population to measure regression against.)

---

## Experiment 3 — Funnel-Focused Fix Presentation

**Maps to canonical loop:** PRIORITIZE → FIX.
**Makes understanding more useful by:** narrowing "what matters" to a concrete user journey so builders see exactly what blocks their key path (report-contract.md: Funnel section `#report-funnel`, sticky nav order Top fixes → All fixes → ... → Funnel → Re-check).

### Hypothesis
Presenting the first-encounter Funnel (what users experience before anything else) as the primary fix-focus entry point — instead of the full unfiltered ranked Flag list — increases fix-completion rate by ≥40% because builders can see exactly what blocks their key journey and act on it immediately.

### Signal / metric
**Fix-completion rate** = (# users who applied ≥1 fix from their review and re-checked successfully) / (# users who received a review with ≥1 fixable Flag).

A/B variant: A = full ranked list default; B = Funnel journey default with "View all fixes" secondary.

Secondary: **Flags-fixed-per-review** = (# unique Flags marked resolved across all re-checks) / (# reviews with ≥1 fixable Flag).

Target sample: 100 reviews per arm (A and B) → ~200 total, with ≥1 fixable Flag each. Expected ~10 fixes per arm at 10% baseline fix rate; 40% lift means ~14 fixes in arm B.

### Decision threshold
- Fix-completion rate lift ≥ 40% (B vs. A), measured as relative increase.
- Flags-fixed-per-review ≥ 1.5× (B vs. A).
- Both must be met to count as "adopt."

### Termination states (per ceo.md protocol)
| State | Evidence that triggers it |
|-------|--------------------------|
| **adopt** | Both thresholds met. Journey-first presentation drives measurable fix action. Make Funnel the default entry for all new reviews. |
| **iterate** | Lift 20–40% (focus helps but evidence/scoping needs refinement). Improve the Funnel visualization or add journey-step severity weighting. |
| **reject** | Lift <20% or negative (presentation does not change behavior). The full ranked list is already optimal; deprioritize Funnel-first work. |
| **inconclusive** | Lift 20–40% but <100 reviews per arm (insufficient sample for statistical significance). Extend the A/B test by 2 weeks. |

### Owner
CEO (Product/Design). Product exec owns the Funnel contract; Design exec owns presentation; Research exec owns hypothesis and termination adjudication.

### Budget posture
**Free-first.** The experiment is a UI presentation variant — no new model calls, no external spend. Both arms use the existing scan pipeline and judge results. Trivial infra cost only.

### Prerequisite signal
Funnel data collected for 100+ reviews with fix-completion and Flags-fixed-per-review tracked. (Without Funnel coverage and fix-tracking, there is no signal to measure the lift against.)

---

## Cross-reference to ceo.md experiment protocol

All three experiments follow the protocol in `.agents/company/ceo.md`:
- **Hypothesis:** recorded for each (above).
- **Owner:** assigned for each (above).
- **Termination rule:** explicit thresholds and evidence triggers per state (above).
- **Termination states:** adopt / iterate / reject / inconclusive — matching ceo.md exactly.
- **Learning reinjection:** each terminated experiment will produce a durable artifact in `.agents/learnings/` and, where it changes shipped behavior, a canonical doc update — per ceo.md "Learning reinjection" and AGENTS.md §8.

## Summary table

| Rank | Experiment | Canonical loop step | Key signal | Threshold | Owner |
|------|-----------|---------------------|------------|-----------|-------|
| 1 | Update Review (Re-check) Loop Closure | VERIFY → LEARN | Re-check initiation rate; verified-fix rate | ≥25% initiation, ≥50% verified | CEO (Product) |
| 2 | Watch Regression Detection | SIGNAL (continuous) | Regression Flags/watch/product/week; action rate | ≥1/week, ≥60% action | CEO (Product) |
| 3 | Funnel-Focused Fix Presentation | PRIORITIZE → FIX | Fix-completion rate; flags-fixed-per-review | ≥40% lift, ≥1.5× fixes | CEO (Product/Design) |
