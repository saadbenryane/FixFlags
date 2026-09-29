/**
 * Whether FixFlags advertises its MCP surface.
 *
 * `AGENTS.md` and ROADMAP Gate 3 both require MCP to stay undiscoverable until the
 * Site/Outcome loop and its authorization are proven end to end. That proof is not
 * in hand, and the current public surface actively contradicts it: a released docs
 * page, a setup page, and machine-readable discovery documents, one of which
 * describes a superseded product with eighteen tools FixFlags does not serve,
 * including four for the parked repository-scan domain.
 *
 * So discovery is off, and it is off behind one constant rather than a scattering of
 * deletions. Every surface that advertises MCP reads this module. Turning discovery
 * back on is a one-line change once the evidence below exists, and that is the point:
 * re-opening a gate should be a decision someone makes on evidence, not an
 * archaeological exercise through whatever was left behind.
 *
 * This module is dependency-free on purpose. `proxy.ts` runs on the edge and must not
 * pull Prisma or any Node-only module into the edge bundle.
 */

/**
 * ROADMAP Gate 3 exit evidence, as a checklist. MCP becomes discoverable when a real
 * credentialed run has recorded every line of this, not when someone asserts it.
 */
export const MCP_DISCOVERY_EVIDENCE = [
  'A coding agent on an owned Site lists watched Outcomes, requests verification, receives a Flag with evidence, records the deployed fix, verifies again, and receives Clear.',
  'Disconnect and restart mid-execution resumes from the same run ID.',
  'Cross-tenant, arbitrary-host, insufficient-scope, revoked-key, rate-limit, worker-down, blocked-target, and incomparable-evidence cases all fail safely.',
  "The agent's own claim that a change succeeded never changes Outcome or Flag state.",
  'A watched Outcome can be created through the product, because until one can be, an agent can read Flags but has no Outcome to verify.',
] as const

export const MCP_IS_DISCOVERABLE = false

/**
 * Discovery paths FixFlags must not answer while `MCP_IS_DISCOVERABLE` is false.
 * The transport itself (`/api/mcp`) and the key and device-authorization routes are
 * deliberately absent: those are how an already-connected client keeps working, and
 * hiding them would break working software instead of an unproven promise.
 */
export const MCP_DISCOVERY_PREFIXES = [
  '/docs/cli',
  '/docs/mcp',
  '/dashboard/mcp-setup',
  '/.well-known',
  '/api/well-known/mcp-json',
] as const

export function isMcpDiscoveryPath(pathname: string): boolean {
  if (MCP_IS_DISCOVERABLE) return false
  return MCP_DISCOVERY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
