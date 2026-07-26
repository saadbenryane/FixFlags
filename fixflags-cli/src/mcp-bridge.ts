import { createInterface } from 'node:readline'
import { API_BASE, requireApiKey } from './credentials.js'

interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
}

function write(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

export async function runMcpBridge(): Promise<void> {
  const apiKey = requireApiKey()
  const lines = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
    terminal: false,
  })

  for await (const line of lines) {
    if (!line.trim()) continue
    let request: JsonRpcRequest
    try {
      request = JSON.parse(line) as JsonRpcRequest
    } catch {
      write({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Invalid JSON from MCP client' },
      })
      continue
    }

    try {
      const response = await fetch(`${API_BASE}/api/mcp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: line,
      })
      const text = await response.text()
      if (text) {
        const payload = JSON.parse(text) as unknown
        write(payload)
      } else if (request.id !== undefined && request.id !== null) {
        write({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32000,
            message: `FixFlags returned HTTP ${response.status} without a response`,
          },
        })
      }
    } catch (error) {
      if (request.id === undefined || request.id === null) continue
      write({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32000,
          message: (error as Error).message,
        },
      })
    }
  }
}
