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
testable claim. The first experiment will likely be the first `/issues/[checkId]`
page (Phase 2): does a data-backed issue page earn impressions within N weeks
of indexing, and does traffic to it convert to audit starts at a meaningfully
different rate than the homepage baseline?
