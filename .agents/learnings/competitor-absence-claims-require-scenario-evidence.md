# Competitor absence claims require scenario evidence

- **Date:** 2026-10-02
- **Scope:** competitive research, positioning and growth handoffs
- **Confidence:** high

## Evidence

The first competitive briefing marked all eight sampled synthetic-monitoring vendors as having no MCP
verification surface. Checkly's official June 2026 release says its MCP server can inspect results and trigger
deployed checks. Datadog's official MCP documentation exposes Synthetics tools. Both were live counterexamples
on 2026-10-02.

The same briefing treated an undated 17-start/3-completion figure as a current funnel. The committed GA4 and GSC
artifacts were fetched on 2026-09-08, contained different aggregate event counts, and could not join a session
to a unique Site start and useful result.

## Discovery

Feature-matrix negatives become false easily because vendors add surfaces, docs are incomplete, and a label
such as "MCP verification" collapses several separate behaviors. A valid comparison must name the scenario and
ask who executes it, who defines success, who may certify recovery, and how recovery or recurrence is recorded.
One counterexample invalidates an exhaustive `none` claim.

Vendor-authored fleet research can support an adjacent problem statement. It does not validate FixFlags,
customer demand, or product-market fit. Aggregate analytics counters without a dated query and join contract do
not establish a conversion funnel.

## Correct approach

Keep a dated primary-source ledger. Record the exact URL, scenario, observation and limitation. Phrase missing
capabilities as "not found on the checked surfaces" unless a repeatable scenario test proves the stronger claim.
Separate shipped, locally implemented and target behavior. Recompute conversion from attributable unique runs
before naming loss or prioritizing its cause.

## Prevention encoded

- `docs/growth/competitive-and-conversion-briefing.md` now carries the corrected matrix, superseded claims,
  dated source ledger and gated handoff prompts.
- `.agents/skills/fixflags-seo-growth-loop/SKILL.md` now requires scenario-level primary-source evidence and
  forbids universal absence claims from incomplete vendor research.
- `docs/growth/README.md` describes the briefing as a dated working brief, not a settled canonical picture.
