# Superseding contracts must terminalize old board work

Date: 2026-10-06
Scope: coordination truth
Confidence: high

## Discovery

The MCP discovery contract changed from “hide the footer but keep the guide
directly reachable” to “withhold every discovery and setup surface until the
real client matrix passes.” The newer gate shipped locally, but the older task
remained in progress. A separate mobile Settings-label task also stayed active
after its shared route implementation and regression test were present.

## Rule

When a newer contract replaces an older task, update the older row to a
terminal state in the same reconciliation. When implementation and evidence
already satisfy a narrow task, close it instead of letting heartbeat treat it
as parallel unfinished work. Terminalizing a row is coordination evidence, not
production or customer validation.

## Prevention encoded

The two stale rows now cite the exact superseding gate or current regression
test. The private MCP guide follows the executable Outcome contract while the
public discovery gate remains closed.

