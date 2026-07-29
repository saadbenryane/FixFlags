# Homepage report screenshots drift from the product

## Finding

A flattened homepage report screenshot can look polished while its hierarchy, counts, filters, and report chrome quietly diverge from the shared report workspace. The July 2026 homepage image showed an older summary and denser nested icon treatments after the real report had moved to `ReportWorkspaceModel`.

## Prevention

- Build homepage report proof from the curated `ReportWorkspaceModel`.
- Reuse shared score, history, rubric, and Flag-list treatments where their behavior matches.
- Keep the homepage projection non-sensitive and truth-preserving: complete curated Flag ranking, one demonstrated prompt, and no invented public report output.
- Remove replaced report screenshots from `lib/marketing/artwork-manifest.json` so the artwork guard does not force stale UI back into the page.

## Evidence

- The live homepage preview and real report now consume the same curated workspace model.
- `npm run agent -- verify` and `npm run agent -- eval ui` passed after the refactor.
- Browser checks at 1280px and 375px showed the same score, Flag counts, rubric coverage, and selected Critical Flag with no horizontal overflow.
