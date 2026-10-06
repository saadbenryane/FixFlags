# Settings responsibility hierarchy

**Task:** `settings-responsibility-hierarchy-2026-10-06`  
**Status:** locally verified; not browser- or production-verified

## Gap found

Site Settings already rendered Outcomes before Watch, but its acceptance test
only checked that headings existed. Shopify, Search Console, and Analytics were
also level-two headings beside the Connections section, and the final section
was titled Remove Site instead of the accepted Danger zone. The visual grid was
close while the document and accessibility hierarchy did not encode the
customer-responsibility order.

## Repair

- The level-two sequence is now exactly Outcomes and fixtures, Watch,
  Notifications, Connections, Developer access, and Danger zone.
- Shopify, Search Console, and Analytics are level-three headings subordinate
  to Connections.
- The destructive action remains the Remove Site button under Danger zone.
- The workspace acceptance document names the same ordered responsibilities.
- The regression test asserts order and heading levels, so a future reordering
  cannot pass merely because every label still exists somewhere on the page.

No fetch, mutation, Watch, connection, fixture, developer-key, or deletion
behavior changed. The existing card styles and responsive grid are preserved.

## Evidence

- Focused Site board and Settings-control suites: 35/35 passed.
- TypeScript, scoped ESLint, and `git diff --check` passed.
- `npm run agent -- verify` passed the 11-command affected manifest, including
  the complete component suite and UI, brand, image, SEO, metadata, copy, and
  help guards. Receipt:
  `.agent-runs/2026-10-06T23-15-25-217Z-help-catalog-guard.log`.

No authenticated browser walk or deployment was performed for this semantic
hierarchy change.

