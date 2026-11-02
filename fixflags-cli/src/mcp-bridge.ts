import { createInterface } from 'node:readline'
import { API_BASE, getCredential } from './credentials.js'
import { readMcpResponse } from './mcp-response.js'

const MAX_IN_FLIGHT_REQUESTS = 8
const MAX_WAITING_REQUESTS = 32

interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

/** HTTP mirrors the modern client's per-request stdio envelope. */
function requestHeaders(request: JsonRpcRequest, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  }
  const meta = request.params?._meta
  const version = meta && typeof meta === 'object' && 'io.modelcontextprotocol/protocolVersion' in meta
    ? meta['io.modelcontextprotocol/protocolVersion'] : undefined
  if (typeof version !== 'string' || !request.method || request.id === undefined || request.id === null) return headers
  headers['MCP-Protocol-Version'] = version
  headers['Mcp-Method'] = request.method
  const fields: Record<string, string> = { 'tools/call': 'name', 'prompts/get': 'name', 'resources/read': 'uri',
    'tasks/get': 'taskId', 'tasks/update': 'taskId', 'tasks/cancel': 'taskId' }
  const value = request.params?.[fields[request.method]]
  if (typeof value === 'string') {
    const plain = value.length > 0 && value === value.trim() && /^[\t\x20-\x7e]+$/.test(value) &&
      !(value.startsWith('=?base64?') && value.endsWith('?='))
    headers['Mcp-Name'] = plain ? value : `=?base64?${Buffer.from(value, 'utf8').toString('base64')}?=`
  }
  return headers
}

function write(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

function authError(id: string | number | null | undefined) {
  return {
    jsonrpc: '2.0' as const,
    id: id ?? null,
    error: {
      code: -32001,
      message: 'Not authenticated. Run fixflags login, or set FIXFLAGS_API_KEY for CI.',
      data: { action: 'login' },
    },
  }
}

export async function runMcpBridge(): Promise<void> {
  const apiKey = await getCredential()
  const lines = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
    terminal: false,
  })
  const pending = new Set<Promise<void>>()
  type Exchange = { line: string; request: JsonRpcRequest; controller: AbortController }
  const waiting: Exchange[] = []
  const requests = new Map<string | number, Exchange>()

  async function forward(line: string, request: JsonRpcRequest, credential: string, signal: AbortSignal) {
    try {
      const response = await fetch(`${API_BASE}/api/mcp`, {
        method: 'POST',
        headers: requestHeaders(request, credential),
        body: line,
        signal,
      })
      const payload = await readMcpResponse(response, request.id)
      if (signal.aborted) return
      if (payload) {
        // HTTP authentication and permission failures may precede JSON-RPC
        // dispatch. Correlate that exchange with its original stdio request.
        if (!response.ok && typeof payload === 'object' && 'error' in payload &&
            'id' in payload && payload.id === null && request.id !== undefined && request.id !== null) {
          write({ ...payload, id: request.id })
        } else write(payload)
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
      if (signal.aborted || request.id === undefined || request.id === null) return
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

  function dispatch() {
    if (!apiKey) return
    while (pending.size < MAX_IN_FLIGHT_REQUESTS && waiting.length) {
      const exchange = waiting.shift()!
      const delivery = forward(exchange.line, exchange.request, apiKey, exchange.controller.signal).finally(() => {
        pending.delete(delivery)
        const id = exchange.request.id
        if (id != null && requests.get(id) === exchange) requests.delete(id)
        dispatch()
      })
      pending.add(delivery)
    }
  }

  for await (const line of lines) {
    if (!line.trim()) continue
    let request: JsonRpcRequest
    try {
      request = JSON.parse(line) as JsonRpcRequest
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON from MCP client' } })
      continue
    }
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      write({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid JSON-RPC request' } })
      continue
    }
    if (!apiKey) {
      write(authError(request.id))
      continue
    }
    // Cancellation belongs to the original HTTP exchange, not a fresh
    // stateless server instance. Keep control input readable at full capacity.
    if (request.method === 'notifications/cancelled' && request.id == null) {
      const id = request.params?.requestId
      const exchange = typeof id === 'string' || typeof id === 'number' ? requests.get(id) : undefined
      if (exchange) {
        exchange.controller.abort()
        const index = waiting.indexOf(exchange)
        if (index !== -1) { waiting.splice(index, 1); requests.delete(id as string | number) }
      }
      continue
    }
    if (request.id != null && requests.has(request.id)) {
      write({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request ID is already in use' } })
      continue
    }
    if (waiting.length >= MAX_WAITING_REQUESTS) {
      if (request.id != null) write({ jsonrpc: '2.0', id: request.id, error: { code: -32000,
        message: 'The local bridge is busy. Retry after an active request finishes.', data: { code: 'BRIDGE_BUSY', recoverable: true, action: 'retry' } } })
      continue
    }
    const exchange = { line, request, controller: new AbortController() }
    if (request.id != null) requests.set(request.id, exchange)
    waiting.push(exchange)
    dispatch()
  }
  while (pending.size) await Promise.race(pending)
}
