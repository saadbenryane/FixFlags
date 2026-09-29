# A public document is a promise, and a discovery document is a promise an agent believes

**Date:** 2026-09-29. **Found while** auditing every place FixFlags states something a
customer or an agent could act on.

## What was wrong

`public/.well-known/mcp-server.json` was a hand-maintained file describing a product that
does not exist. It advertised **eighteen** tools. The MCP server serves nine. Not one of the
eighteen names existed in `lib/mcp/tool-registry.json`.

It was wrong in three separate ways, and each would have been enough on its own:

1. **Every tool name was fictional.** `ff_check_and_plan`, `ff_get_report`, `ff_get_rubric`,
   `ff_get_all_fixes`, `ff_plan_mode_prompt`, `ff_compare`, and eleven more.
2. **The product description was a superseded framing.** "Product Intelligence for AI-built
   products... a ranked Fix List across Message, Experience, and Reach" is the framing
   `knowledge/vision.md` replaced on 2026-09-21.
3. **It advertised the parked domain.** `ff_start_repo_scan`, `ff_list_repo_scans`,
   `ff_get_repo_scan`, and `ff_get_repo_finding` are repository-scan tools, and
   `AGENTS.md` says repo scan "stays parked". The discovery document was inviting agents
   into a capability the roadmap deliberately withheld.

`content/docs/mcp.md` had the same disease in milder form: seven `ff_*` names where the
registry has nine `fixflags.*` names, including a `ff_verify_outcome` that never existed and
an omission of `record_fix`, the tool that answers "did the fix restore the outcome".

The same file `public/.well-known/skills/index.json` said, in the same directory:

> "Agent distribution is parked until it supports the same Site and Flag model."

So the repository already knew agent distribution was parked, and was serving a document
advertising it in the next folder.

## Why a stale copy is worse than a missing document

A missing endpoint produces an error the caller can diagnose. A **wrong** one does not. An
agent that reads a discovery document has been told the contract, and it will call
`ff_get_report` and conclude FixFlags is broken, rather than conclude the document lied. The
damage is asymmetric: silence is recoverable, confident misinformation is not.

This is the same failure shape as the `SIGNUP` binding refusal, one layer up. There, a
mechanism FixFlags could not run was written into a customer's agreement. Here, a mechanism
FixFlags does not have was written into a machine-readable promise. Both were copies of a
truth that drifted from the thing that owns it.

## The rule

**Anything an agent or customer can act on must be derived from the module that owns it, not
copied beside it.**

Implemented as:

- `lib/docs/mcp-tool-reference.ts` renders the published tool list from `MCP_TOOL_DEFINITIONS`.
- `app/api/well-known/mcp-json/route.ts` generates the whole discovery document from the same
  definitions, using `BRAND.oneLiner` for the product sentence.
- `lib/docs/generated-blocks.ts` substitutes `<!-- generated:mcp-tools -->` into the markdown,
  and **throws on an unknown marker** so a page cannot silently lose a section.
- `lib/docs/__tests__/mcp-guide-drift.test.ts` fails if the guide names a tool FixFlags does
  not serve, or omits one it does.

The static `.well-known/mcp-server.json` was deleted rather than corrected. Correcting it
would leave a second document to maintain for a capability that must not be discoverable yet,
and duplicated truth is the thing that rotted in the first place.

## The second finding: the guard was asserting the opposite of the invariant

`lib/__tests__/public-product-scope.test.ts` listed `/api/mcp`, `/docs/mcp`, `/docs/cli`,
`/dashboard/mcp-setup`, `/.well-known/**` and `/api/well-known/mcp-json` under a test named
`preserves the URL review path`, and `lib/docs/catalog.ts` had `/docs/mcp` in the released
`DOCS_PAGES`. A test does not merely observe a decision. **A test named "preserves X" is a
decision, written down, that X should be preserved.** Nobody had to override the invariant to
violate it; the invariant had already been encoded as the opposite expectation, and it was
green.

`AGENTS.md` says MCP "remains undiscoverable until its Site/Outcome end-to-end loop and
authorization are proven". Gate 3's exit evidence requires an agent to list watched Outcomes,
request verification, receive a Flag with evidence, record the deployed fix, verify again, and
receive Clear. That proof is absent, and it is structurally absent: **no MCP tool can create a
watched Outcome**, and production held 9 Outcomes, all `GENERIC`, with 0 confirmed. An
agent-only account connects, lists, and finds nothing to verify.

So discovery is now withheld behind `lib/mcp/discoverability.ts`, one constant, and the gate
carries the Gate 3 checklist as `MCP_DISCOVERY_EVIDENCE` so re-opening it is a decision made
against evidence rather than archaeology through whatever was left behind. The transport,
`/api/mcp`, the API-key routes, and the device flow deliberately stay reachable: withholding
discovery must not break an already-connected client, because that breaks working software
instead of an unproven promise.

`scripts/power-tools-visibility-guard.mjs` already existed for exactly this job and already had
an MCP carve-out. Rather than bolt on a new check, the carve-out ended: the guard now reads
the gate module and fails three ways — edge stopped consulting the gate, gate lost a path,
gate opened without revisiting the withheld list. Each of the three was verified red by
injection before being trusted green.

## Red-green, because a green test proves nothing about itself

Four probes, each reverted:

| Probe | Expected | Result |
| --- | --- | --- |
| Inject `ff_list_sites` back into the guide | guide-drift test red | red, naming `ff_list_sites` |
| Re-link `/dashboard/mcp-setup` from live settings | visibility guard red | red |
| Flip `MCP_IS_DISCOVERABLE = true` | visibility guard red | red, "MCP is discoverable again" |
| Restore the `VERIFIED` write in the integrity probe | site-flag test red | red |

A guard that has never failed has not been shown to guard anything.

## The unrelated find worth keeping

`lib/integrity/site-flag.ts` wrote `Improvement.status = 'VERIFIED'` when a single scheduled
path probe came back GREEN. `VERIFIED` is FixFlags' claim that a fresh comparable execution
proved recovery, and both the Site Agent (`agent.ts:111`) and run reconciliation
(`run-requests.ts:593`) read it as exactly that. A probe walks one URL, so a consent
interstitial or a redirect could resolve a Flag the customer was told stays open "until the
same page and action pass". This was the only production site writing that field outside the
verification service, and the existing test asserted the behavior, so the defect was pinned
rather than caught.

The probe now changes nothing on GREEN. Recovery is the Verify path's job, which runs the
real check and records the attempt.
