# AI triage needs purpose and enforcement

Rendered dogfood of `example.com` on 2026-09-26 showed that correct deterministic severity is not enough. The deterministic layer kept placeholder-page CTA, privacy/contact, and navigation observations at `POLISH`, but triage rephrased them as two `CRITICAL` Flags and one `IMPORTANT` Flag.

Prevent this at three boundaries:

1. Pass the deterministic page-purpose result into the request-specific triage context. A placeholder, docs page, article, or OSS page must not be judged as a marketing funnel.
2. Keep metadata, browser geometry, CTA-label, privacy/contact, and internal-navigation themes exclusively deterministic in `deduplicate.ts`. Triage deduplication must compare the model's actual evidence and impact text, not replace them with the title before matching.
3. Enforce the strongest positive classification in validation. A positively identified placeholder has no product funnel to critique, so model-created Flags are discarded while captured deterministic facts remain.

A prompt reminder alone is not an accuracy gate. The persisted report must still be safe when the model ignores the instruction.

Local queue dogfood also exposed a separate operational trap: two live worker heartbeats meant jobs raced between a healthy worker and an orphaned browser-unready worker. Check the aggregate heartbeat and exact worker processes before diagnosing intermittent capture failures.
