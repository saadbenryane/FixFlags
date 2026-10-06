# Final receipts must revalidate evidence shape

Date: 2026-10-06
Scope: evidence-gated release aggregation
Confidence: high

## Discovery

The paid-opening stage checked for seven passed Watch gates, but did not require
their canonical names. Final aggregation checked only that the nested status was
passed and that no provided gate was non-passing, so an empty or renamed gate
object could survive after stage ingestion.

## Rule

Evidence summaries are untrusted inputs at every persistence boundary. The
final aggregator must re-run the same schema and consistency checks used when
the evidence was first ingested; counting fields or trusting a prior PASS is
not enough.

## Prevention encoded

- The Watch validator requires the exact seven gate identities, non-empty
  summaries, a complete 14-day timestamp window, and integer count metrics.
- It independently checks the exercised notification, quiet-success,
  deduplication, cost, loss, sample, and completion invariants.
- The sanitized Watch projection retains SHA and hashed database binding.
- Final aggregation invokes the same validator, so missing, renamed, extra,
  inconsistent, or post-stage-tampered evidence cannot produce a final PASS.
