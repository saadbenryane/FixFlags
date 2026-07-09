# Learnings

Dated log of what worked and what didn't. Append-only — never delete a past
learning, even if later contradicted. If a later learning supersedes an
earlier one, say so explicitly and leave both.

---

## 2026-07-09 — Phase 1 foundation build

**What we did:** Designed and implemented the knowledge-graph schema (10
new tables), the persist/query/snapshot service layer, backfill + rollup
scripts, and wired live persistence into the audit finalize path.

**What we learned:**

- The existing `Flag` model already carried almost everything a knowledge
  graph needs (`fingerprint`, `checkId`, `rubric`, 5 tool-specific fix
  prompts). The graph layer is mostly a **denormalization + aggregation**
  problem on top of data FixFlags already collects — not a from-scratch data
  model. This is a good sign: the product was already generating the right
  shape of knowledge, it just wasn't being aggregated or exposed.
- Keeping the new FK columns (`Audit.siteId`, `AuditPage.pageId`,
  `Flag.issueId`) **nullable** made the migration safe to ship without a
  backfill happening atomically — a real constraint of a live production
  system with existing rows, not a hypothetical concern.
- Deliberately **not** shipping any public page in Phase 1 (per explicit
  instruction from the project owner) turned out to be the right call
  independent of the instruction — the brief's own philosophy ("don't
  optimize for publishing more pages") argues for measuring the graph before
  building templates against it. Building queries against imagined data
  would have meant redoing them once real distributions were visible.
- Deferred aggregate-counter computation (rollup, not inline) to keep the
  audit hot path fast — this is a repeatable pattern for future graph
  writes: **write raw events cheaply, aggregate on schedule**.

**What we'd do differently next time:** nothing yet identified — too early.
Revisit after the backfill actually runs against production data; the real
distribution of sites/issues may reveal schema gaps (e.g. the `Issue`
fingerprint granularity might be too coarse or too fine — we won't know until
real data populates it).
