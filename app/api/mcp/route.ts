import type { ApiKeyClient } from '@prisma/client'
import { NextRequest } from 'next/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { registerAllTools, validateApiKey } from '@/lib/mcp/tools'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  extractAuditIdFromToolResult,
  extractMcpLogMetadata,
  logMcpInteraction,
  parseJsonRpcResponseOutcome,
  parseMcpRequestSummary,
  readJsonResponseBody,
  resolveInteractionAuditId,
} from '@/lib/mcp/log-interaction'
import { extractMcpCredential } from '@/lib/mcp/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

async function handleMcpRequest(req: NextRequest): Promise<Response> {
  const credential = extractMcpCredential(req.headers)

  let user: import('@prisma/client').User | null = null
  let apiKey: { id: string; client: ApiKeyClient | null } | null = null

  if (credential.ok) {
    const authContext = await validateApiKey(credential.key)
    if (!authContext) {
      return Response.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Provide a valid FixFlags API key. Create one at /settings/api-keys.',
            data: { code: 'INVALID_API_KEY', action: 'create_api_key' },
          },
          id: null,
        },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="FixFlags"' } }
      )
    }
    user = authContext.user
    apiKey = authContext.apiKey
  } else if (credential.code === 'INVALID_AUTHORIZATION' || credential.code === 'CONFLICTING_API_KEYS') {
    return Response.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: credential.message,
          data: { code: credential.code, action: 'provide_api_key' },
        },
        id: null,
      },
      {
        status: credential.code === 'CONFLICTING_API_KEYS' ? 400 : 401,
        headers: { 'WWW-Authenticate': 'Bearer realm="FixFlags"' },
      }
    )
  }

  let requestSummary = { method: 'unknown', tool: null as string | null, auditIdFromParams: null as string | null }
  try {
    const clone = req.clone()
    const body = await clone.json()
    requestSummary = parseMcpRequestSummary(body)
  } catch {
    // body not parseable - proceed without method/tool context
  }

  const server = new McpServer(
    { name: 'fixflags', version: process.env.npm_package_version || '0.1.0' },
    { capabilities: { tools: {} } }
  )
  registerAllTools(server, user, { signal: req.signal })

  const host = req.headers.get('host') ?? new URL(req.url).host
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    enableDnsRebindingProtection: true,
    allowedHosts: [host],
  })

  const start = Date.now()
  await server.connect(transport)
  try {
    const response = await transport.handleRequest(req)
    const durationMs = Date.now() - start
    const responseBody = await readJsonResponseBody(response)
    const outcome = responseBody ? parseJsonRpcResponseOutcome(responseBody) : { success: true }
    const auditIdFromResult =
      responseBody != null
        ? extractAuditIdFromToolResult(
            requestSummary.tool,
            extractToolResultContent(responseBody)
          )
        : null
    const auditId = resolveInteractionAuditId(
      requestSummary.auditIdFromParams,
      auditIdFromResult
    )

    if (user && apiKey) {
      await logMcpInteraction(
        {
          userId: user.id,
          apiKeyId: apiKey.id,
          client: apiKey.client,
          method: requestSummary.method,
          tool: requestSummary.tool,
          success: outcome.success,
          durationMs,
          errorCode: outcome.errorCode,
          auditId,
          metadata: responseBody
            ? extractMcpLogMetadata(responseBody, response.status)
            : { httpStatus: response.status },
        },
        (data) => prisma.mcpInteraction.create({ data })
      )
    }
    return response
  } catch (error) {
    const duration = Date.now() - start
    const errorCode = error instanceof Error ? error.message.slice(0, 100) : 'unknown'
    if (user && apiKey) {
      await logMcpInteraction(
        {
          userId: user.id,
          apiKeyId: apiKey.id,
          client: apiKey.client,
          method: requestSummary.method,
          tool: requestSummary.tool,
          success: false,
          durationMs: duration,
          errorCode,
          auditId: requestSummary.auditIdFromParams,
          metadata: { httpStatus: 500 },
        },
        (data) => prisma.mcpInteraction.create({ data })
      )
    }
    if (user) {
      logger.error('MCP request failed', {
        userId: user.id,
        method: requestSummary.method,
        tool: requestSummary.tool,
        error,
      })
    }
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

function extractToolResultContent(body: unknown): unknown {
  const record = body as { result?: { content?: Array<{ type?: string; text?: string }> } }
  const content = record?.result?.content
  if (!Array.isArray(content) || content.length === 0) return null
  const textItem = content.find((item) => item?.type === 'text' && typeof item.text === 'string')
  return textItem?.text ?? null
}

export const POST = handleMcpRequest
export const GET = handleMcpRequest
export const DELETE = handleMcpRequest
