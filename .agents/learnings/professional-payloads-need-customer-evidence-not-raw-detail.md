# Professional payloads need customer evidence, not raw detail

Date: 2026-10-06
Scope: MCP Outcome results
Confidence: high

## Discovery

The MCP Outcome listing exposed state and timestamps but dropped the readable
evidence, limitation, and recovery information present in the customer UI. A
coding agent could see “Couldn’t verify” without the safe next action. Simply
returning the stored execution object would have restored context by leaking
fixture scope and raw diagnostic detail.

## Rule

Professional interfaces should reuse the customer truth projection, then cross
a narrow serializer that exposes evidence summaries and durable identifiers.
Do not rebuild status logic beside the UI, and do not confuse “more technical”
with permission to return secrets, binding configuration, or raw evidence.

## Prevention encoded

`mcpOutcomePayload` serializes the tenant-scoped Outcome detail projection,
gives inconclusive evidence its own freshness label, and intentionally omits
scope, fixture identifiers, raw reasons, and detail. Focused tests assert both
the registered tool path and those redactions.

