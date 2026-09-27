import { describe, expect, it } from 'vitest'
import type { User } from '@prisma/client'
import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { McpServer } from '@modelcontextprotocol/server'
import { MCP_TOOL_DEFINITIONS, MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { registerAllTools } from '@/lib/mcp/tools'

describe('MCP SDK lifecycle', () => {
  it('initializes, negotiates, discovers every canonical tool, and closes', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const server = new McpServer(
      { name: 'fixflags-test', version: '1.0.0' },
      { capabilities: { tools: {} } }
    )
    registerAllTools(server, { id: 'user-1' } as User)

    const client = new Client({ name: 'fixflags-test-client', version: '1.0.0' })
    await server.connect(serverTransport)
    await client.connect(clientTransport)

    const result = await client.listTools()

    expect(result.tools.map((tool) => tool.name).sort()).toEqual(
      MCP_TOOL_DEFINITIONS.map((tool) => tool.name).sort()
    )
    const attemptTool = result.tools.find(
      (tool) => tool.name === MCP_TOOLS.run.name
    )
    expect(attemptTool).toMatchObject({
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    })
    expect(attemptTool?.inputSchema).toMatchObject({
      properties: {
        siteId: { type: 'string' },
        outcomeIds: { type: 'array' },
        idempotencyKey: { type: 'string' },
      },
    })
    expect((attemptTool?.inputSchema as { properties?: object })?.properties).not.toHaveProperty(
      'reportId'
    )

    const connection = await client.callTool({
      name: MCP_TOOLS.getConnectionInfo.name,
      arguments: {},
    })
    expect(connection.isError).not.toBe(true)
    expect(connection.structuredContent).toMatchObject({
      contractVersion: '3.0',
      protocolVersion: '2026-07-28',
      ready: true,
      authentication: { type: 'bearer', authenticated: true },
      clientInfo: { name: 'fixflags-test-client', version: '1.0.0' },
    })
    const connectionContent = connection.content as Array<{ type: string; text?: string }>
    expect(JSON.parse(connectionContent[0]?.text ?? '{}')).toEqual(
      connection.structuredContent
    )
    await client.close()
    await server.close()
  })
})
