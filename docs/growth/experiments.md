# Experiments

Hypothesis → implementation → outcome log. One entry per significant
improvement we treat as an experiment rather than a certainty.

Template for new entries:

```md
## [YYYY-MM-DD] Title

**Hypothesis:** what we believe and why

**Implementation:** what we actually shipped

**Success metric:** the single number that decides this

**Outcome:** what happened (fill in after enough time has passed)

**Lessons learned:** what we'd do differently

**Future recommendations:** what this unlocks or forecloses
```

---

No experiments run yet — Phase 1 is foundational infrastructure, not a
testable claim. The experiments below are planned for Phase 2.

---

## [PLANNED] First issue page: does data-backed content earn organic traffic?

**Hypothesis:** A page that displays FixFlags-unique data (issue frequency,
top frameworks, anonymized examples, canonical fix prompt) will earn organic
impressions within 4 weeks of indexing, at a higher rate than a generic
"what is X issue" article — because it carries information gain no other
page has.

**Implementation:** Ship `/issues/[checkId]` for the first check crossing
MIN_SAMPLE_SIZE after the self-seed batch. Include structured data
(`Article` + `Dataset`), internal links to related issues, and an audit CTA.

**Success metric:** >500 impressions within 30 days of indexing (GSC data),
or >100 impressions within 30 days if GSC access is not yet available
(fallback: verify crawlable via `curl` and robots checks).

**Outcome:** (fill after implementation)

**Lessons learned:** (fill after outcome)

**Future recommendations:** (fill after lessons)

---

## [PLANNED] Free tool conversion: does meta-preview drive audit starts?

**Hypothesis:** A free OG preview checker tool will generate top-of-funnel
traffic and convert a meaningful percentage of users into audit starts —
because the tool demonstrates FixFlags' capability and the natural next step
is "run a full audit."

**Implementation:** Ship `/tools/meta-preview` with a prominent "Run a full
audit" CTA below the tool result. Track via `ToolUsage` with `sessionId`
correlation to `Audit.source`.

**Success metric:** >15% of tool sessions result in an audit start (measured
via `ToolUsage.sessionId` → `Audit` correlation). >100 tool uses within 30
days.

**Outcome:** (fill after implementation)

**Lessons learned:** (fill after outcome)

**Future recommendations:** (fill after lessons)
