import { NextRequest } from 'next/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { registerAllTools, validateApiKey } from '@/lib/mcp/tools'

export const runtime = 'nodejs'
export const maxDuration = 60

async function handleMcpRequest(req: NextRequest): Promise<Response> {
  const apiKey = req.headers.get('x-api-key')
  const user = await validateApiKey(apiKey)
  if (!user) {
    return Response.json(
      {
        code: 'UNAUTHORIZED',
        message: 'Provide a valid x-api-key header',
        action: 'create_api_key',
        requestId: crypto.randomUUID(),
      },
      { status: 401 }
    )
  }

  const server = new McpServer(
    { name: 'qualityos', version: '2.0.0' },
    { capabilities: { tools: {} } }
  )
  registerAllTools(server, user)

  const host = req.headers.get('host') ?? new URL(req.url).host
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    enableDnsRebindingProtection: true,
    allowedHosts: [host],
  })

  await server.connect(transport)
  try {
    return await transport.handleRequest(req)
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'mcp.request.failed',
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return Response.json(
      {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal MCP server error' },
        id: null,
      },
      { status: 500 }
    )
  }
}

export const POST = handleMcpRequest
export const GET = handleMcpRequest
export const DELETE = handleMcpRequest
