/**
 * Whether FixFlags advertises its MCP surface.
 *
 * Discovery was off while `AGENTS.md` and ROADMAP Gate 3 required MCP to stay
 * undiscoverable until the Site/Outcome loop and its authorization were proven end to
 * end. On 2026-11-10 the product owner opened the gate by decision, ahead of that
 * proof. The docs guide, the setup page, the connect page, and the machine-readable
 * discovery documents are therefore public again. Each of them describes only the
 * tools in `lib/mcp/tool-manifest.ts` and the transport at `/api/mcp`. The superseded
 * hand-written discovery file, with tools FixFlags does not serve and the parked
 * repository-scan domain, is gone and must not come back.
 *
 * Opening the gate does not establish the evidence below. `MCP_DISCOVERY_EVIDENCE`
 * remains the outstanding proof checklist: no public claim may describe any of it as
 * proven until a real credentialed run has recorded it, and plugin or directory
 * submission stays blocked on it (`lib/growth/plugin-readiness.ts`).
 *
 * Every surface that advertises MCP still reads this module, so closing discovery again
 * is a one-line change plus restoring the withheld paths below. That is the point:
 * moving a gate should be a decision someone makes, not an archaeological exercise
 * through whatever was left behind.
 *
 * This module is dependency-free on purpose. `proxy.ts` runs on the edge and must not
 * pull Prisma or any Node-only module into the edge bundle.
 */

/**
 * ROADMAP Gate 3 exit evidence, as a checklist. Discovery is open by owner decision,
 * but none of these lines is proven until a real credentialed run has recorded it.
 */
export const MCP_DISCOVERY_EVIDENCE = [
  'A coding agent on an owned Site lists watched Outcomes, requests verification, receives a Flag with evidence, records the deployed fix, verifies again, and receives Clear.',
  'Disconnect and restart mid-execution resumes from the same run ID.',
  'Cross-tenant, arbitrary-host, insufficient-scope, revoked-key, rate-limit, worker-down, blocked-target, and incomparable-evidence cases all fail safely.',
  "The agent's own claim that a change succeeded never changes Outcome or Flag state.",
  'A watched Outcome can be created through the product, because until one can be, an agent can read Flags but has no Outcome to verify.',
] as const

export const MCP_IS_DISCOVERABLE = true

/**
 * Discovery paths FixFlags must not answer while `MCP_IS_DISCOVERABLE` is false.
 * Empty while discovery is open. When the gate is closed, this held `/docs/mcp`,
 * `/dashboard/mcp-setup`, `/.well-known`, and `/api/well-known/mcp-json` (plus
 * `/docs/cli`, which only redirects to `/docs/mcp` in `next.config.ts`).
 * The transport itself (`/api/mcp`) and the key and device-authorization routes are
 * deliberately never listed: those are how an already-connected client keeps working,
 * and hiding them would break working software instead of an unproven promise.
 */
export const MCP_DISCOVERY_PREFIXES: readonly string[] = []

export function isMcpDiscoveryPath(pathname: string): boolean {
  if (MCP_IS_DISCOVERABLE) return false
  return MCP_DISCOVERY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
