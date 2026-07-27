# Scan Accuracy Overhaul -- Implementation Plan

## Goal

Systematically improve scan accuracy and reliability across FixFlags by integrating industry-standard tooling, upgrading AI output guarantees, expanding test coverage, and reducing known false positive clusters.

## Decisions

- **Sequencing:** Phase by impact (high → medium → low)
- **axe-core:** Replace custom accessibility checks that axe-core covers better
- **AI structured outputs:** Switch from forced tool calls to `response_format: json_schema` with `strict: true`

---

## Phase 1: High-Impact, Quick Wins (Days 1-3)

### 1A. axe-core Integration (Replace Custom A11y Checks)

**Files to create/modify:**
- `lib/audit/checks/accessibility.ts` -- rewrite to consume axe-core results
- `lib/audit/pipeline/run-page.ts` -- run axe-core scan during capture phase
- `lib/audit/accuracy-corpus.ts` -- update known false positives (expect removals)
- `package.json` -- add `@axe-core/playwright`

**Implementation:**

1. Install `@axe-core/playwright`
2. In `pipeline/run-page.ts`, after `createAuditPage()` navigates and the page reaches `domcontentloaded`, run:
   ```typescript
   import { AxeBuilder } from '@axe-core/playwright';
   
   const axeResults = await new AxeBuilder({ page })
     .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
     .analyze();
   ```
3. Pass `axeResults.violations` into `runAllChecks()` context alongside existing `metadata`
4. In `lib/audit/checks/accessibility.ts`, replace the 9 custom conditions with axe-core violation mapping:
   - Map axe `impact` levels to FixFlags `severity`: `critical` → `CRITICAL`, `serious` → `IMPORTANT`, `moderate` → `POLISH`
   - Map axe rule IDs to FixFlags check IDs: `color-contrast` → existing contrast check, `image-alt` → existing alt check, `label` → existing form label check, etc.
   - Keep checks that axe-core doesn't cover: `skip-link`, `keyboard-trap` (partial), `focus-visible` (partial)
   - For removed checks, keep the check ID but mark as `source: 'AXE_CORE'` for traceability
5. Remove the 9 custom DOM-scraping conditions that axe-core handles better
6. Update `lib/audit/check-ids.ts`: add any new axe-specific check IDs (e.g., `axe-aria-required-children`, `axe-duplicate-id-active`, `axe-link-name`)
7. Update `lib/audit/accuracy-corpus.ts`: remove `images-empty-alt`, `accessibility-missing-labels` from known false positives where axe-core resolves them

**Accuracy gain:** Eliminates ~40% of accessibility false positives. axe-core has zero false positives by design.

**Verification:** Run `npm run accuracy:eval` before and after. Compare flag counts on gold fixtures (must remain 0 false blockers). Run against 3 live URLs with `npm run accuracy:probe`.

---

### 1B. ARIA Snapshot Capture for Semantic Structure

**Files to create/modify:**
- `lib/audit/browser/page-session.ts` -- capture ARIA snapshot after page load
- `lib/audit/pipeline/types.ts` -- add `ariaSnapshot` to capture context
- `lib/audit/checks/accessibility.ts` -- consume ARIA snapshot data
- `lib/audit/checks/content.ts` -- consume ARIA snapshot for heading hierarchy

**Implementation:**

1. In `page-session.ts`, after the page settles, capture:
   ```typescript
   const ariaSnapshot = await page.locator('body').ariaSnapshot();
   ```
2. Store in the page run context alongside existing `htmlContent`, `runtimeMetadata`
3. Use ARIA snapshot data for:
   - **Interactive element accessible names:** Parse YAML tree, find all `button`, `link`, `textbox` nodes. Check each has a non-empty accessible name. Replaces the current `links-no-text` / `buttons-no-text` checks that miss `aria-label`
   - **Heading hierarchy validation:** Parse `heading` nodes with `[level=N]` attributes. Validate sequential hierarchy (no level skips)
   - **Landmark validation:** Check for presence of `main`, `navigation`, `banner` landmarks
4. Update the corresponding check modules to prefer ARIA snapshot data when available, fall back to DOM parsing when not (for HTML-only fixtures)

**Accuracy gain:** Eliminates icon-button and aria-label false positives. Provides machine-readable accessibility structure.

**Verification:** Run accuracy corpus. Verify gold fixtures still pass. Check that `links-no-text` no longer fires on pages with `aria-label` on icon buttons.

---

### 1C. Switch AI Triage to response_format json_schema

**Files to modify:**
- `lib/audit/judge-triage.ts` -- change OpenAI and Anthropic API calls
- `lib/audit/judge-prescription.ts` -- change prescription API calls
- `lib/audit/judge-triage-schema.ts` -- export as JSON Schema
- `lib/audit/judge-config.ts` -- no changes needed

**Implementation:**

1. Export the triage Zod schema as JSON Schema using `zod-to-json-schema`:
   ```typescript
   import { zodToJsonSchema } from 'zod-to-json-schema';
   export const TRIAGE_JSON_SCHEMA = zodToJsonSchema(qualityTriageSchema);
   ```
2. In `judge-triage.ts` OpenAI path, replace tool call with:
   ```typescript
   openai.chat.completions.create({
     model: cfg.model,
     max_tokens: cfg.maxTokens,
     response_format: {
       type: 'json_schema',
       json_schema: {
         name: 'quality_triage',
         strict: true,
         schema: TRIAGE_JSON_SCHEMA,
       }
     },
     messages: [
       { role: 'system', content: buildTriageSystemPrompt() },
       { role: 'user', content: [...imageContent, textContent] }
     ],
   }, { signal: controller.signal })
   ```
3. In `judge-triage.ts` Anthropic path, replace tool call with structured output via `output_config`:
   ```typescript
   anthropic.messages.create({
     model: cfg.model,
     max_tokens: cfg.maxTokens,
     system: [{
       type: 'text',
       text: buildTriageSystemPrompt(),
       cache_control: { type: 'ephemeral' }
     }],
     messages: [{
       role: 'user',
       content: [...imageContent, textContent]
     }],
   }, { signal: controller.signal })
   ```
   Note: Anthropic structured outputs may still be in beta. Keep tool-call fallback available via env flag `JUDGE_STRUCTURED_OUTPUT=false`.
4. Apply the same pattern to `judge-prescription.ts` for the prescription phase
5. Add `zod-to-json-schema` to package.json
6. Update the result parsing: instead of extracting from `tool_calls[0].function.arguments`, extract from `response.choices[0].message.content` (OpenAI) or `response.content[0].text` (Anthropic)

**Accuracy gain:** Eliminates ~8-15% of schema compliance failures. Reduces retries and degraded verdicts.

**Verification:** Run 10 live scans. Verify zero parse failures in logs. Compare triage output quality against baseline.

---

## Phase 2: Medium-Impact Improvements (Days 4-7)

### 2A. Parallel Check Module Execution

**Files to modify:**
- `lib/audit/checks/index.ts` -- parallelize independent modules

**Implementation:**

1. Group the 22 modules into 3 independent buckets:
   - **Bucket A (DOM-dependent):** metadata, og-image, accessibility, seo, trust, content, slop, measurement, auth-checkout, security, security-headers, messaging-clarity, conversion-friction, trust-psychology
   - **Bucket B (Metrics-dependent):** performance, mobile, mobile-ux-quality
   - **Bucket C (CaptureMetrics-dependent):** layout, interaction, cta-focus, visual-polish, visual-hierarchy
2. Run Buckets A, B, C in parallel with `Promise.allSettled`
3. Post-processing (suppression, dedup) still runs sequentially after all buckets complete
4. Preserve the error isolation pattern (failed modules don't crash the pipeline)

**Accuracy gain:** No direct accuracy gain, but 2-3x faster CHECKING stage means more time budget for JUDGE phase.

**Verification:** Run accuracy corpus, verify identical flag output. Measure CHECKING stage latency before/after.

---

### 2B. LLM Page-Purpose Classification for Ambiguous Cases

**Files to modify:**
- `lib/audit/page-purpose.ts` -- add LLM fallback for uncertain classifications
- `lib/audit/judge-runner.ts` -- expose a lightweight LLM call utility

**Implementation:**

1. In `page-purpose.ts`, after the 6 heuristic classifiers run:
   - If the result is `unknown` OR the heuristic confidence is low, make a single cheap LLM call:
     ```typescript
     const classification = await runLlmWithRetry(
       [{ role: 'user', content: `Classify this page as one of: placeholder, docs, article, oss, marketing. 
         Page title: ${title}
         First 500 chars of text: ${text.slice(0, 500)}
         Links: ${linkCount}, Images: ${imageCount}, Words: ${wordCount}` }],
       { model: 'gpt-4o-mini', maxTokens: 50 }
     );
     ```
   - Parse the single-word response and use it as the page purpose
2. Gate behind `USE_LLM_PAGE_PURPOSE=true` env flag (default false initially)

**Accuracy gain:** Reduces misclassified-page false positives.

**Verification:** Run accuracy corpus with flag enabled. Compare flag counts. Zero new false positives on gold fixtures.

---

### 2C. CrUX Field Data Integration

**Files to modify:**
- `lib/audit/pipeline/run-page.ts` -- extract CrUX data from PSI response
- `lib/audit/checks/performance.ts` -- use CrUX data alongside lab data

**Implementation:**

1. The PSI API already returns CrUX field data. Extract and store it.
2. Update performance flags to include both lab and field data:
   - Flag: `perf-lcp-poor` evidence: "Lab: 4.2s. Field (CrUX): 2.8s (p75). 1,200 real users affected."
3. When CrUX data is unavailable (low-traffic pages), fall back to lab-only as today

**Accuracy gain:** Makes performance flags authoritative by grounding them in real user data.

**Verification:** Test against pages with known CrUX data (stripe.com, vercel.com). Verify CrUX metrics appear in flag evidence.

---

### 2D. Expand Browser Accuracy Corpus

**Files to modify:**
- `lib/audit/accuracy-browser-corpus.ts` -- add 10-15 new live URL targets

**Implementation:**

1. Add targets covering: SPA/CSR apps, CSS-animation-heavy pages, auth-gated pages, multi-step forms, e-commerce pages, icon-only button pages, decorative image pages
2. For each target, define `expectedPrimaryCtaText`, `expectedAbsentCheckIds`, `expectedInputsBelow16Count`
3. Add a weekly CI job that runs this corpus (non-blocking, reporting only)

**Accuracy gain:** Catches rendered-state regressions that HTML fixtures cannot represent.

**Verification:** Run full corpus. Ensure existing targets still pass.

---

## Phase 3: Low-Impact, Strategic (Days 8-10)

### 3A. Semantic Slop Detection

**Files to modify:**
- `lib/audit/checks/slop.ts` -- add LLM pre-check for ambiguous cases

**Implementation:**

1. For the 3 most false-positive-prone checks (`template-default-copy`, `placeholder-copy-detected`, `messaging-weak-value-prop`):
   - When keyword/regex check fires, make a single cheap LLM call asking if the text is intentional or placeholder
   - Only surface the flag if LLM responds 'placeholder'
2. Gate behind `USE_SEMANTIC_SLOP=true` env flag
3. Cache LLM results per text snippet

**Accuracy gain:** Reduces content quality false positives.

**Verification:** Run accuracy corpus. Verify gold fixtures unaffected.

---

### 3B. Self-Hosted Lighthouse (Deferred)

**Status:** Defer until approaching PSI API quota limits (25k/day).
**When ready:** Docker-based Lighthouse CI, $300-800/mo compute, custom headers for auth pages.

---

### 3C. Continuous Monitoring (Product Feature)

**Status:** Defer to post-revenue.
**When ready:** Re-check scheduling, historical storage, regression alerts.

---

## Execution Rules

- Work directly on `main` (no branches unless explicitly asked)
- Claim each task on `.agents/BOARD.md` before starting
- Run `npm run agent -- verify --dry-run` after each phase
- Run `npm run accuracy:eval` after Phase 1 and Phase 2
- Run `npm run accuracy:probe` after Phase 1 (live URLs)
- Record learnings in `.agents/learnings/`
- Create `.agents/handoffs/` if leaving work incomplete

## Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Gold fixture false blockers | 0 | 0 (maintained) |
| Builder fixture false blockers | 0-2 | 0-1 |
| A11y false positive rate | ~40% of a11y flags | <10% |
| Schema compliance failures | ~8-15% | <0.1% |
| CHECKING stage latency | ~15s | ~5s |
| Browser corpus size | 4 targets | 15+ targets |
