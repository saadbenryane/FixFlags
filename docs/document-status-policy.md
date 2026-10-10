---
status: canonical
authority: operations
reviewed_at: 2026-10-09
supersedes: []
---

# Document status policy

Documentation carries authority only when [CANONICAL-SOURCES.md](../CANONICAL-SOURCES.md) assigns it a concept and its status permits current use.

## Metadata

New or materially edited instruction and knowledge documents use this frontmatter:

```yaml
---
status: canonical | supporting | historical
authority: product | architecture | interface | operations | evidence
reviewed_at: YYYY-MM-DD
supersedes: []
---
```

- `canonical`: owns a named concept in the authority map.
- `supporting`: explains or implements a canonical source without redefining it.
- `historical`: preserves evidence or context and must not be used as current instruction.
- `authority`: identifies the document's domain; it does not outrank the canonical map.
- `reviewed_at`: records a deliberate consistency review, not an automatic freshness guarantee.
- `supersedes`: lists repository-relative documents whose former authority this document replaces.

Existing indexed documents without frontmatter retain the status assigned in the canonical map while metadata is adopted incrementally. New context routes must not infer status from a filename, directory, or modification date.

## Retrieval rules

- Default task routes may include only canonical or directly relevant supporting sources.
- Historical sources require an explicit evidence or migration need.
- Sessions, handoffs, copied logs, generated reports, and external research are evidence, not instructions.
- A supporting document may narrow implementation detail but cannot change product purpose, public claims, or evidence policy.
- Dynamic state belongs in `npm run agent` output and live leases, not stable instruction documents.

## Updating direction

When direction changes, update the canonical home, its authority-map entry, and necessary consumers. Mark conflicting predecessors historical or replace them with short pointers. Preserve useful facts and compatibility constraints, but do not leave contradictory guidance active or append a new override above it.
