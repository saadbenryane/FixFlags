# MCP Outcome evidence payload

**Task:** `mcp-outcome-evidence-payload-2026-10-06`  
**Status:** locally verified; MCP remains undiscoverable; real-client matrix open; not deployed

## Gap found

`fixflags.list_outcomes` returned the Outcome state, coverage and timestamps, but
not the customer-readable evidence sentence, the exact limitation, or the
recovery action already present on the Outcome responsibility page. Its local
limitation reconstruction also omitted paused and stale recovery states. A
professional client could therefore know that an Outcome was inconclusive
without knowing what FixFlags observed or what to do next.

## Repair

- The tool now loads the same tenant-scoped Outcome detail projection used by
  the customer experience and serializes it through a dedicated MCP boundary.
- Freshness is explicit: `CURRENT`, `STALE`, `INCONCLUSIVE`, or `UNVERIFIED`.
  A fresh “Couldn’t verify” assessment is never mislabeled current.
- Each method includes its customer-readable evidence summary, disposition,
  observation time, and Audit identity.
- The expected result, Outcome kind, and criticality accompany the current
  answer so a professional client does not have to infer the responsibility
  from its name.
- Limitation, recovery action, last successful verification time, coverage,
  and the existing compatibility timestamps remain available.
- Binding scope, fixture identifiers, raw execution reasons, evidence detail,
  form values, and hook credentials are not serialized.
- Generic legacy Outcomes remain excluded, and the tool still resolves every
  Outcome through the owned Site boundary.

The change is additive. It does not add an MCP tool, expose fixture management,
change scopes, enable public discovery, or relax the client-matrix gate.

## Evidence

- Focused projection and registered-tool tests passed: 3/3.
- TypeScript, scoped ESLint, and `git diff --check` passed.
- `npm run agent -- verify` passed the 12-command affected manifest, including
  all MCP tests, the MCP quality gate, TypeScript, full lint, and repository
  guard suites. Receipt:
  `.agent-runs/2026-10-06T23-10-30-179Z-help-catalog-guard.log`.

No credentialed Codex, Claude Code, or Cursor session was available in this
change. The production matrix remains required before discovery or public MCP
claims can be enabled.
