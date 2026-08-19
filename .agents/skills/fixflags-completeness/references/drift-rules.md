# Completeness drift review

Use this checklist after automated validation. Canonical product, report, security,
design, and quality sources remain authoritative; this file only routes the
manual review that scripts cannot fully prove.

## Shipped truth

- Compare visible capabilities and claims with `PRODUCT.md`.
- Reject invented proof, unsupported counts, placeholder evidence, and
  aspirational behavior presented as shipped.
- Confirm visible language follows `SOUL.md` and `docs/voice-and-copy.md`.

## Product and report contracts

- Trace Check → Fix → Re-check → Watch through the UI, HTTP boundary, CLI, and
  MCP task contracts.
- Confirm ranking, report access, anonymous redaction, evidence, and prompt
  availability agree with `knowledge/report-contract.md` and `SECURITY.md`.
- Confirm Message, Experience, and Reach remain the only customer-facing
  report rubrics.

## Evidence overlay

- Live Flag highlights must come from `Flag.evidenceTargets` measured at capture time.
- A missing measurement is a chip, not a preset hero rectangle.
- Product Preview uses `EvidenceSpotlight` / `EvidenceChip`. Stage geometry must not change.

## Interface behavior

- Exercise loading, empty, partial, error, forbidden, completed, and Re-check
  states that apply to the changed surface.
- Check keyboard order, focus visibility, semantic names, 44px targets, reduced
  motion, 200% reflow, and responsive behavior at 375, 768, and 1280px.
- Inspect the rendered artifact and browser console, not only test exit codes.

## Runtime and release

- Verify web and worker roles start independently with their own health
  boundaries and do not compete for local verification resources.
- Treat missing release credentials, sandbox accounts, reset consent, mailbox
  assertions, and deployed URLs as explicit blockers.
- Do not replace credentialed release evidence with local mocks or skipped
  checks.

## Knowledge reconciliation

- Put new facts in the canonical source named by `knowledge/README.md`.
- Remove obsolete instructions instead of adding compatibility prose.
- Record durable, measured failures and their prevention in
  `.agents/learnings/`.
