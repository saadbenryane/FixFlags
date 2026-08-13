import { afterEach, describe, expect, it } from 'vitest'
import type { User } from '@prisma/client'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { registerAllTools } from '@/lib/mcp/tools'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'

describe('MCP Streamable HTTP lifecycle', () => {
  let server: McpServer | undefined

  afterEach(async () => {
    await server?.close()
  })

  it('initializes, discovers tools, and calls connection info over real HTTP messages', async () => {
    server = new McpServer(
      { name: 'fixflags-http-test', version: '1.0.0' },
      { capabilities: { tools: {} } }
    )
    registerAllTools(server, { id: 'user-1' } as User)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => 'session-test',
      enableJsonResponse: true,
    })
    await server.connect(transport)
    let sessionId: string | null = null

    const send = async (body: Record<string, unknown>) => {
      const headers: Record<string, string> = {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      }
      if (sessionId) headers['mcp-session-id'] = sessionId
      const response = await transport.handleRequest(
        new Request('https://fixflags.test/api/mcp', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })
      )
      sessionId = response.headers.get('mcp-session-id') ?? sessionId
      return response.status === 202 ? null : response.json()
    }

    const initialized = await send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'generic-http-client', version: '2.1.0' },
      },
    }) as { result?: { serverInfo?: { name?: string } } }
    expect(initialized.result?.serverInfo?.name).toBe('fixflags-http-test')

    await send({ jsonrpc: '2.0', method: 'notifications/initialized' })

    const listed = await send({
      jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
    }) as { result?: { tools?: Array<{ name: string }> } }
    expect(listed.result?.tools?.some((tool) => tool.name === MCP_TOOLS.getConnectionInfo.name))
      .toBe(true)

    const called = await send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: MCP_TOOLS.getConnectionInfo.name, arguments: {} },
    }) as { result?: { structuredContent?: Record<string, unknown> } }
    expect(called.result?.structuredContent).toMatchObject({
      contractVersion: '1.0',
      ready: true,
      clientInfo: { name: 'generic-http-client', version: '2.1.0' },
    })
  })
})
