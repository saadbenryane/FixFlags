# Learnings

Dated log of what worked and what didn't. Append-only — never delete a past
learning, even if later contradicted. If a later learning supersedes an
earlier one, say so explicitly and leave both.

## 2026-07-10: Check quality iteration 2

- **Use an audit agent to systematically review check modules.** Running an exploration agent across all 22 check modules produced a thorough findings doc in <30s. Would have taken much longer reading each file manually.
- **Audit reports can hallucinate.** The agent reported `layout.ts` missing `impactTag` — but it was there. Always verify findings by reading the actual file before editing.
- **Severity changes in check modules cascade to regression tests.** Fix 9 (measurement consent severity) broke 1 fixture in `regression-sites.test.ts`. The fixture had analytics but was expecting POLISH — our fix correctly promoted it to IMPORTANT. Updating the test expectation was the right call.
- **`slow-replay.ts` sentinel value pattern.** The probe sets a sentinel of 30_000ms for "never appeared." The check used this value as-is in evidence text, misleading users. Fix: detect the sentinel and use different wording ("was not detected" vs "appeared after Xms"). Simpler than refactoring the probe to return null.
- **Word-boundary matters for CTA text matching.** Single-word weak phrases like `start` and `try` need exact-match (`ctaText === p`) while multi-word phrases like `learn more` can use `startsWith`. The original code used `startsWith` for all phrases, causing false positives on "Start free trial" etc.
- **Threshold changes need before/after check on fixture tests.** Lowering `visual-hierarchy.ts` bodyText threshold from 50 to 10 and removing `home` from generic phrases didn't break any fixtures — showing the fixtures don't exercise those exact edge cases.
- **Do not trust line numbers from agent reports without verification.** Agent report said line 20 for layout.ts - actually line 24. Account for file changes between agent context and current state.
- **`metadata.ts` is shared infra — changes here cascade to all text-based checks.** Increasing `pageText` slice from 3000→8000 affects every module that uses `meta.pageText`. Always run the full test suite after touching it.
- **Word-boundary regex in CTA extraction prevents phantom CTA matches.** `includes('start')` matches "startup", "Starter" — `\bstart\b` does not. This was the root cause of phantom CTA detection affecting 6+ downstream checks.
- **Auth-checkout HEAD-only detection has a known false-positive vector.** Some servers return different statuses for HEAD vs GET. Adding a GET fallback after HEAD 404/5xx eliminates this at the cost of an extra request per dead link.
- **Form validation detection should account for native HTML5 validation types.** `type="email"`, `type="url"`, etc. provide native browser validation without `required`/`pattern`. Previously these were falsely flagged as missing validation.
- **Analytics provider detection should be specific to avoid false positives.** `facebook` is too broad (matches Facebook links, share buttons); `fbq(` matches the Facebook Pixel call. Same for Twitter: `static.ads-twitter.com` matches the pixel, not general Twitter mentions.
- **Font-family thresholds should be consistent across check modules.** `visual-polish` used `>4`, `visual-hierarchy` used `>3`. Aligned both to `>4` so font-count warnings are always the same check.
- **v1-fixture-audit test needs >5s timeout.** The default vitest 5s timeout isn't enough for the full offline pipeline. Bumped global testTimeout to 30s.
- **NPM test script is `test:unit`, not `test`.** This project uses vitest configured as `test:unit`.

---

## 2026-07-10 — Iteration 3-4: Check quality, report UX, prompt context

**What we did:** Fixed 8+ check quality issues (thumb zone, sentinel wording,
H1 threshold, weak label, risk reversal regex, email regex, consent severity),
added dedup rules for overlapping check IDs, removed dead code, added Top
Priorities section + Copy All button to report, fixed flow message-mismatch
logic, improved tap target evidence with element counts, and increased AI
prompt context (pageText 500→5000, tech stack, H2 headings).

**What we learned:**

- **`page-text-limits.ts` defines storage and prompt limits (5000 chars stored/prescription, 2500 triage).** Always trace the complete storage→retrieval chain before changing prompt input sizes. See `lib/audit/page-text-limits.ts`.
- **Triage gets fresh metadata (up to 8000-char raw text); prescription gets stored metadata (up to 5000 chars).** The triage runs inline during the pipeline with the just-parsed metadata. Prescription runs as a separate job and reads from the DB.
- **`topFixPrompt && !explorerModel` is logically impossible.** When
  `topFixPrompt` is truthy (fix prompts exist), `explorerModel` is always
  truthy (built from same flags array). The dead section and `showFix` nav
  prop were legacy from before `LiveReportExplorer`. Always cross-check the
  conditions when working with report component state.
- **`collectAllFixPrompts` has no test coverage.** When adding a new
  utility with formatting logic (indexed separators, empty handling), add
  tests immediately. The "Copy all" button depended on untested code.
- **Tech stack detection is stored in `auditPage.performanceData`, not in
  `htmlMetadata`.** To pass it to the AI prescription, we had to include
  `audit.pages` in the Prisma query and extract from `performanceData`.
  This indirection should be documented — it's easy to miss that two
  separate storage locations contain page intelligence.
- **`getTopFixPromptFromFlags` duplicates the sorting logic of
  `rankFlagsByPriority` but returns only a single result.** When we removed
  its only consumer (the dead `topFixPrompt` section), the function and its
  tests were left orphaned. Consider consolidating: `rankFlagsByPriority`
  with limit=1 returns the same result.
- **`slow-replay.ts` is NOT imported through the checks barrel.** It's a
  side-channel module directly called by `deterministic-audit.ts`. This is
  intentional — it requires browser probe results, not just HTML metadata.
  The `check-ids.ts` comment reference is documentation, not dead code.
- **The `showFix`, `showOverview`, `showFlow`, `showPreviews` pattern in
  `ReportMiniNav` is flexible but creates dead-code surface area.** Each
  boolean creates a condition that can be permanently false. When removing
  a section, clean up both the section and its nav entry.

**What we'd do differently next time:**
- Before changing any prompt template's slice/truncation, trace the full
  data pipeline from source → storage → retrieval → prompt.
- For any new UI section (Top Priorities), verify rendering state across
  all conditions: signed-in, signed-out, locked, no flags, etc.
- Add test coverage for new utility functions in the same PR as the
  function definition.

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

---

## 2026-07-09 — Iteration 1: Flag/fix quality improvements

**What we did:** Improved the precision of deterministic flag evidence (slop
checks now include the actual matched text, not just a label), added 5 new
AI-builder-specific slop patterns, expanded the triage prompt with concrete
UX dimension questions per rubric, strengthened the prescription prompt to
demand file-path-level specificity, and expanded fix-action-copy.ts with more
tool integration labels.

**What we learned:**

- **Slop evidence is the highest-leverage deterministic improvement.** The
  `detectSocialProofSlop` function returned only a label string. Changing its
  return type to `{ label, matched }` broke 1 test file (4 test cases), which
  was easy to update. The gain is that users now see *what* matched, not just
  which pattern category fired. This pattern (return match metadata, not just
  a flag) should be used for future evidence improvements.
- **The project bans em dashes (U+2014) in source.** The `no-em-dash.test.ts`
  test catches them. When writing example text in prompts, use a regular
  hyphen `-` instead. This is a project-wide convention enforced by a test.
- **Existing verification rules cover all check IDs.** The test
  `every checkId has a verification rule` covers 100% of check IDs, so we did
  not need to add verification rules — focus on evidence and fix text instead.
- **Triage prompt changes are low-risk because they don't affect the schema.**
  The AI output is validated by Zod schemas, so prompt text changes
  (questions, instructions) won't cause test failures. The contract tests
  (`judge-contract.test.ts`) validate the output shape, not the prompt text.
- **fix-action-copy.ts is imported in UI components** — adding new keys is
  safe as long as existing consumers (there's only one test for cursorMcpLabel)
  are not broken. The new keys can be adopted incrementally by UI components.
- **The npm/pnpm dual-lockfile situation persists** — `package-lock.json` and
  `pnpm-lock.yaml` both exist. Tests run with `npx vitest` (which resolves
  from `node_modules`), so either lockfile works for test execution.

**What we'd do differently next time:**
- When changing a return type (`detectSocialProofSlop`), search for ALL
  callers proactively rather than waiting for the test run to reveal them.
- The new AI-builder slop patterns should be validated against real-world
  AI-built pages before the next iteration — some may have false-positive
  rates that need tuning (e.g., "Add your X" could match legitimate copy).

---

## 2026-07-09 — Architecture review and system design

**What we did:** Comprehensive audit of every file in the growth system
— schema, graph layer, marketing copy, SEO setup, analytics, audit pipeline,
scripts, routes, and documentation. Designed the four-layer architecture
and identified 6 architectural gaps.

**What we learned:**

- **The attribution gap is the most dangerous flaw.** The core loop
  (audit -> knowledge -> pages -> trust -> acquisition -> audit) has a
  measurement break: we can't trace which public page drove which signup.
  This is invisible until you try to measure the loop, and by then you've
  shipped pages without tracking. Fix this before Phase 2, not after.

- **The existing codebase is remarkably well-structured for pre-launch.**
  The knowledge graph schema covers the right entities, the persist/query
  boundary is correctly enforced, and the audit pipeline already captures
  everything needed for rich public pages. The 133 check IDs across 22 modules are a goldmine of data waiting to be aggregated.

- **Industry/tech detection is the single biggest blocker to benchmark
  pages.** The `htmlMetadata` JSON on `AuditPage` likely already contains
  enough signal (framework detection, builder fingerprints) — check there
  before building new detection logic from scratch.

- **Free tools have zero blockers and should ship in parallel with the
  self-seed batch.** meta-preview and placeholder-detector don't need the
  knowledge graph at all — they're the fastest path to top-of-funnel
  traffic and the easiest way to validate the tool → audit conversion funnel.

- **The four-layer model (Data Collection → Intelligence → Public
  Surfaces → Measurement & Feedback) makes gaps visible.** The original
  architecture had Layers 1-3 designed but Layer 4 was implicit. Making it
  explicit means every future decision can be evaluated against "does this
  improve measurement?"

- **MIN_SAMPLE_SIZE is the right quality gate but needs to be applied
  consistently.** It should gate not just page rendering but also sitemap
  inclusion and structured data generation. One gate, three surfaces.

**What we'd do differently next time:**
- Design the measurement layer (Layer 4) at the same time as the data layer
  (Layer 1), not after. The original architecture focused on "how do we
  collect and expose data" without asking "how do we know if exposing it
  works."
- Start the competitive research pass earlier — we're building pages in a
  space we haven't confirmed is empty. If a direct competitor exists, our
  positioning needs to be sharper from day one.
