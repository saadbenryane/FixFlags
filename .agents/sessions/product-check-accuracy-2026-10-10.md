---
status: evidence
authority: evidence
reviewed_at: 2026-10-10
---

# Website-to-observations accuracy pass

Implemented fixes in the isolated product-check-accuracy worktree; no deployment was performed.

## Findings and changes

- Deferred primary CTA walks discarded network/form evidence and did not persist their serialized flow. Preserve the originating page evidence, persist the walk, and deduplicate capture/walk findings.
- Page sessions froze the initial null form-probe value. Expose the current result after interaction, so a real upstream 500 reaches the report checks.
- Verification receipts preceded the deferred walk. Record them after execution and treat timed-out/skipped walks as incomplete.
- The flow deadline was measured before capture. Measure the remaining budget at execution and reserve the judge budget. Close contexts on thrown walks.
- The repaired demo's live AI findings claimed a missing audience and missing measurable testimonial results despite visible contrary text. Remove the minimum finding quota, evaluate headline/subheading together, and require source-matching quoted evidence for MESSAGE/REACH findings before persistence.
- The all-check trigger test only warned about missing coverage. Add six Search Console triggers and enforce exact registry coverage.

## Real behavior evidence

- Broken demo submission: `cmv304qdo0001ny20c0y37h8d`, completed with 25 raw findings and partial coverage.
- Repaired demo submission: `cmv307din0006ny208xyd5lmj`, Site `p_cmv307div0007ny20nfp8eenk`, completed with full coverage. The Site board and detail pages rendered at 1280px and 375px without horizontal overflow or browser exceptions.
- Independently confirmed real contrast failures at 4.46:1 and two 404 destinations. Two visible high-severity AI findings were contradicted by the rendered subheading/testimonial. No production rows were modified.
- A fresh live provider evaluation with the revised local code returned zero AI findings for the repaired demo, preserving the deterministic contrast finding. This was a direct provider evaluation, not a deployed full-pipeline rerun.
- A hermetic Chromium interaction against a local failing subscription endpoint returned upstream HTTP 500 and emitted `form-submit-api-server-error` after interaction.
- The existing 14-target live geometry corpus and 16-fixture offline accuracy gate passed; these do not establish universal accuracy.

## Validation and limits

Focused production-path, provider-boundary, evidence-grounding, trigger-registry, and form-session regression coverage passes. The final affected suite passed 1,833 tests; nine database/Redis integration cases were skipped without their designated integration environment. TypeScript passed. Earlier lint passed before the final form-session edit; the later broad verification was stopped at the user's request to prioritize fixes over repeated tests. Final diff whitespace validation passed.

The changes are reviewable locally. Fresh deployed full-pipeline validation of the patched version, authenticated Verify/Watch, and exhaustive cross-site false-positive adjudication were not performed. Source-matching quotes reduce unsupported text claims but do not prove the model's interpretation; visual AI judgments retain their existing screenshot validation limits.
