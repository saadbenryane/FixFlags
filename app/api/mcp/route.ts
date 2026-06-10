import { NextRequest } from 'next/server'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerAllTools, validateApiKey } from '@/lib/mcp/tools'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const user = await validateApiKey(apiKey)

  if (!user) {
    return Response.json({ error: 'Unauthorized — provide x-api-key header' }, { status: 401 })
  }

  const body = await req.json()

  // JSON-RPC notifications carry no id and get no response — ack immediately
  // instead of waiting out the response timeout below.
  if (body && typeof body === 'object' && !Array.isArray(body) && body.id === undefined) {
    return new Response(null, { status: 202 })
  }

  const server = new McpServer({ name: 'qualityos', version: '1.0.0' })
  registerAllTools(server, user)

  // Use in-memory transport pair to process a single request
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  await server.connect(serverTransport)

  // Collect the response from the server
  let responseMessage: unknown = null
  const originalOnMessage = clientTransport.onmessage

  await new Promise<void>((resolve) => {
    clientTransport.onmessage = (message) => {
      responseMessage = message
      resolve()
    }
    // Send the request through the client transport
    clientTransport.send(body).catch(() => resolve())
    // Timeout after 50s
    setTimeout(resolve, 50_000)
  })

  if (responseMessage) {
    return Response.json(responseMessage)
  }

  return Response.json({ error: 'No response from MCP server' }, { status: 500 })
}
