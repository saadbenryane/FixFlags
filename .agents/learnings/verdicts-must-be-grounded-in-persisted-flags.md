# Verdicts must be grounded in persisted Flags

**Date:** 2026-08-13
**Scope:** production dogfood, AI triage, rendered mobile evidence, and public verdict integrity
**Confidence:** high

## Finding

A production FixFlags-on-FixFlags Review claimed the primary mobile call to action was not visible, but the captured 375 × 812 screenshot showed both the header and hero actions fully visible.
The rendered accuracy probe measured the hero action at 345px in an 812px viewport and emitted no `cta-below-fold-mobile` Flag.
The persisted Review contained ten Flags, none of which supported the verdict claim.

## Prevention

- Validate and deduplicate all AI Flags first.
- Derive the public verdict from the highest-priority Flag that survives validation.
- Treat free-form model verdict prose as untrusted when it contradicts persisted evidence.
- Keep `https://fixflags.com/` in the rendered browser corpus with `cta-below-fold-mobile` explicitly absent.
- Reproduce this exact contradiction in `false-positive-hardening.test.ts`.
