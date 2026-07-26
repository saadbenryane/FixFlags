import { describe, expect, it } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { User } from '@prisma/client'
import { registerAllTools } from '@/lib/mcp/tools'
import { MCP_TOOL_DEFINITIONS, MCP_TOOLS } from '@/lib/mcp/tool-manifest'

describe('MCP public tool manifest', () => {
  it('registers every typed public tool exactly once', () => {
    const registered: string[] = []
    const server = {
      tool(name: string) {
        registered.push(name)
        return {}
      },
    } as unknown as McpServer
    const user = { id: 'user-1' } as User

    registerAllTools(server, user)

    const expected = MCP_TOOL_DEFINITIONS.map((tool) => tool.name)
    expect(registered).toHaveLength(18)
    expect(new Set(registered).size).toBe(registered.length)
    expect([...registered].sort()).toEqual([...expected].sort())
  })

  it('keeps names and descriptions unique and non-empty', () => {
    const definitions = Object.values(MCP_TOOLS)

    expect(new Set(definitions.map((tool) => tool.name)).size).toBe(definitions.length)
    expect(definitions.every((tool) => tool.name.length > 0 && tool.desc.length > 0)).toBe(true)
  })
})
