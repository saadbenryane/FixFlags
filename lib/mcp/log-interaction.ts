export interface McpRequestSummary {
  method: string
  tool: string | null
  auditIdFromParams: string | null
}

export interface JsonRpcOutcome {
  success: boolean
  errorCode?: string
}

export interface LogMcpInteractionInput {
  userId: string
  method: string
  tool: string | null
  success: boolean
  durationMs: number
  errorCode?: string
  auditId?: string | null
  metadata?: Record<string, unknown>
}

const AUDIT_ID_PARAM_KEYS = [
  'reportId',
  'parentReportId',
  'beforeId',
  'afterId',
  'auditId',
] as const

export function parseMcpRequestSummary(body: unknown): McpRequestSummary {
  const record = asRecord(body)
  const method = String(record?.method ?? 'unknown')
  let tool: string | null = null
  let auditIdFromParams: string | null = null

  if (method === 'tools/call') {
    const params = asRecord(record?.params)
    tool = params?.name != null ? String(params.name) : null
    const args = asRecord(params?.arguments)
    auditIdFromParams = extractAuditIdFromArgs(args)
  }

  return { method, tool, auditIdFromParams }
}

export function parseJsonRpcResponseOutcome(body: unknown): JsonRpcOutcome {
  const record = asRecord(body)
  const error = asRecord(record?.error)
  if (error) {
    const code = error.code != null ? String(error.code) : undefined
    const message =
      typeof error.message === 'string' ? error.message.slice(0, 100) : undefined
    return {
      success: false,
      errorCode: message ?? code ?? 'jsonrpc_error',
    }
  }
  return { success: true }
}

export function extractAuditIdFromToolResult(
  tool: string | null,
  resultContent: unknown
): string | null {
  if (!tool) return null

  const fromObject = extractAuditIdFromArgs(asRecord(resultContent))
  if (fromObject) return fromObject

  if (typeof resultContent !== 'string') return null

  try {
    const parsed = JSON.parse(resultContent) as unknown
    return extractAuditIdFromArgs(asRecord(parsed))
  } catch {
    return null
  }
}

export function resolveInteractionAuditId(
  auditIdFromParams: string | null,
  auditIdFromResult: string | null
): string | null {
  return auditIdFromResult ?? auditIdFromParams
}

export async function readJsonResponseBody(response: Response): Promise<unknown | null> {
  try {
    const clone = response.clone()
    const contentType = clone.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) return null
    return await clone.json()
  } catch {
    return null
  }
}

export async function logMcpInteraction(
  input: LogMcpInteractionInput,
  create: (data: {
    userId: string
    method: string
    tool: string | null
    success: boolean
    durationMs: number
    errorCode?: string
    auditId?: string | null
    metadata?: Record<string, unknown>
  }) => Promise<unknown>
): Promise<void> {
  try {
    await create({
      userId: input.userId,
      method: input.method,
      tool: input.tool,
      success: input.success,
      durationMs: input.durationMs,
      errorCode: input.errorCode,
      auditId: input.auditId ?? undefined,
      metadata: input.metadata,
    })
  } catch {
    // logging never breaks the request flow
  }
}

function extractAuditIdFromArgs(args: Record<string, unknown> | null): string | null {
  if (!args) return null

  for (const key of AUDIT_ID_PARAM_KEYS) {
    const value = args[key]
    if (typeof value === 'string' && value.length > 0) return value
  }

  if (typeof args.reportId === 'string') return args.reportId
  if (typeof args.report_id === 'string') return args.report_id

  const nested = asRecord(args.result)
  if (nested) return extractAuditIdFromArgs(nested)

  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}
