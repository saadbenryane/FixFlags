import { afterEach, describe, expect, it } from 'vitest'
import type { User } from '@prisma/client'
import { createMcpHandler, McpServer, type McpHttpHandler } from '@modelcontextprotocol/server'
import { registerAllTools } from '@/lib/mcp/tools'
import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'

describe('MCP 2026-07-28 stateless handler', () => {
  let handler: McpHttpHandler | null = null

  afterEach(async () => {
    await handler?.close()
    handler = null
  })

  it('serves the modern envelope and the explicit stateless legacy fallback from one registry', async () => {
    handler = createMcpHandler(() => {
      const server = new McpServer({ name: 'fixflags-modern-test', version: '1.0.0' })
      registerAllTools(server, { id: 'user-1' } as User)
      return server
    }, { legacy: 'stateless', responseMode: 'json' })

    const modern = await handler.fetch(new Request('https://fixflags.test/api/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': 'tools/list',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientInfo': { name: 'modern-test', version: '1.0.0' },
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        },
      }),
    }))
    expect(modern.status, await modern.clone().text()).toBe(200)
    const modernBody = await modern.json() as { result?: { tools?: Array<{ name: string }> } }
    expect(modernBody.result?.tools?.map((tool) => tool.name).sort()).toEqual(
      MCP_TOOL_DEFINITIONS.map((tool) => tool.name).sort(),
    )

    const legacy = await handler.fetch(new Request('https://fixflags.test/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'legacy-test', version: '1.0.0' } },
      }),
    }))
    expect(legacy.status).toBe(200)
    const legacyText = await legacy.text()
    const legacyPayload = legacyText.startsWith('event:')
      ? legacyText.split('\n').find((line) => line.startsWith('data:'))?.slice(5).trim() ?? '{}'
      : legacyText
    const legacyBody = JSON.parse(legacyPayload) as { result?: { protocolVersion?: string } }
    expect(legacyBody.result?.protocolVersion).toBe('2025-11-25')
  })
})
