# Watch release-evidence schema integrity

**Task:** `watch-release-evidence-schema-integrity-2026-10-06`  
**Status:** locally verified; no production query or paid-access change

## Failure found

`validateWatchLaunchEvidence` accepted any seven gate objects whose status read
`passed`. `validateFinalReceiptObjects` was weaker: an empty gate object with a
top-level passed status was sufficient. The real producer emitted the correct
shape, but schema drift, truncation, or a modified stage receipt could bypass
the intended proof at final aggregation.

## Repair

- Require exactly `sample`, `terminalCompletion`, `noLostRuns`,
  `notificationRecords`, `quietClear`, `flagDeduplication`, and `economics`.
- Require every gate to be passed with a non-empty summary.
- Validate exact ISO timestamps, a complete 14-day window, and a first Watch
  request at or before the window start.
- Validate all count metrics as non-negative integers and require internally
  consistent sample, settlement, completion, notification, quiet-success,
  duplicate-Flag, and cost facts.
- Preserve schema version, candidate SHA, hashed database identity, timestamps,
  metrics, and gates in the sanitized receipt projection.
- Re-run the complete validator during final receipt aggregation.

## Evidence

- Focused release contracts passed 32/32, including renamed and missing gates,
  incomplete notification records, invalid observation windows, and a
  post-stage empty-gate receipt.
- The complete script suite passed 104/104.
- ESLint passed for both changed release files.
- The final 30-command repository manifest passed with container receipt
  `.agent-runs/2026-10-06T22-45-47-632Z-container-build.log`; unit results were
  5,899 passed and 18 skipped.

The production Watch cohort is still unproven. This change protects how that
future evidence is accepted; it does not manufacture a passing cohort.
