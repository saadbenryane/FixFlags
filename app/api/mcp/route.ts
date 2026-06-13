import { NextRequest } from 'next/server'
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
  const abortController = new AbortController()

  req.signal.addEventListener('abort', () => abortController.abort(), { once: true })

  const server = new McpServer({ name: 'qualityos', version: '1.0.0' })
  registerAllTools(server, user)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  let responseMessage: unknown = null

  await new Promise<void>((resolve) => {
    clientTransport.onmessage = (message) => {
      responseMessage = message
      resolve()
    }

    clientTransport.send(body).catch(() => resolve())

    const timeout = setTimeout(resolve, 50_000)
    abortController.signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout)
        resolve()
      },
      { once: true }
    )
  })

  if (responseMessage) {
    return Response.json(responseMessage)
  }

  if (abortController.signal.aborted) {
    return Response.json({ error: 'Client disconnected' }, { status: 499 })
  }

  return Response.json({ error: 'No response from MCP server' }, { status: 500 })
}
