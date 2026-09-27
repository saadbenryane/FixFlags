import registry from '@/lib/mcp/tool-registry.json'

export type McpScope =
  | 'sites:read'
  | 'runs:read'
  | 'runs:write'
  | 'flags:read'
  | 'flags:write'

export type McpToolDefinition = {
  name: string
  desc: string
  scope: McpScope
  title: string
  readOnly: boolean
}

export const MCP_CONTRACT_VERSION = registry.contractVersion
export const MCP_PROTOCOL_VERSION = registry.protocolVersion
export const MCP_TOOLS = registry.tools as Record<keyof typeof registry.tools, McpToolDefinition>
export const MCP_TOOL_DEFINITIONS = Object.values(MCP_TOOLS)
export const MCP_CORE_TOOL_DEFINITIONS = MCP_TOOL_DEFINITIONS
export const MCP_OPTIONAL_TOOL_DEFINITIONS: McpToolDefinition[] = []

export function toolDefinition(name: string | null): McpToolDefinition | null {
  if (!name) return null
  return MCP_TOOL_DEFINITIONS.find((tool) => tool.name === name) ?? null
}

export function inspectMcpToolReadiness(toolNames: Iterable<string>) {
  const available = new Set(toolNames)
  const missingCore = MCP_TOOL_DEFINITIONS
    .map((tool) => tool.name)
    .filter((name) => !available.has(name))

  return {
    contractVersion: MCP_CONTRACT_VERSION,
    protocolVersion: MCP_PROTOCOL_VERSION,
    ready: missingCore.length === 0,
    missingCore,
    optional: [],
  }
}

export type McpToolName = (typeof MCP_TOOL_DEFINITIONS)[number]['name']
