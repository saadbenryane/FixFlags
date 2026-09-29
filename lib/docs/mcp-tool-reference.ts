import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'

/**
 * The published MCP tool list, derived from the registry FixFlags actually serves.
 *
 * The tool names are the wire contract. A hand-written copy of them in documentation
 * drifts the moment a tool is renamed, and a client that follows a stale guide calls
 * a name that does not exist. This module is the only place the public list is written,
 * so the two cannot disagree.
 */
export function renderMcpToolReference(): string {
  return MCP_TOOL_DEFINITIONS.map(
    (tool) => `- \`${tool.name}\` (${tool.scope}) ${tool.desc}`
  ).join('\n')
}

/** Every tool name FixFlags serves. Used to prove the guide names nothing else. */
export function mcpToolNames(): string[] {
  return MCP_TOOL_DEFINITIONS.map((tool) => tool.name)
}
