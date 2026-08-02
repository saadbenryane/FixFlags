import type { User } from '@prisma/client'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { checkAndPlan, recheckAndCompare } from '@/lib/audit/task-contracts'
import { assertMcpAccess } from '@/lib/mcp/access'
import { recordRateLimit } from '@/lib/security/rate-limit'
import {
  computeEnqueueDelay,
  getWorkerQueueEstimate,
  type QueueStatus,
} from '@/lib/queue/estimate'
import { buildAttribution } from '@/lib/leads/attribution'
import { assertPublicAuditUrl } from '@/lib/audit/url'
import { scanAccessInputSchema, parseScanAccessInput } from '@/lib/audit/scan-access'
import { canUseEphemeralScanAccess } from '@/lib/audit/scan-access-auth'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { PROMPT_TOOL_KEYS } from '@/lib/mcp/builders'
import { AuditUrlError } from '@/lib/audit/url'
import { RateLimitError } from '@/lib/security/rate-limit'

function taskError(error: unknown) {
  const typed = error as Error & { code?: string; action?: string; status?: number }
  let code = typed.code ?? 'MCP_TASK_FAILED'
  let action = typed.action ?? 'retry'

  if (error instanceof AuditUrlError) {
    code = /private|reserved|publicly accessible/i.test(error.message)
      ? 'PRIVATE_TARGET'
      : 'INVALID_URL'
    action = 'provide_public_url'
  } else if (error instanceof RateLimitError || typed.status === 429) {
    code = 'RATE_LIMITED'
    action = 'retry_later'
  } else if (/upgrade|pro plan|plan/i.test(typed.message ?? '')) {
    code = 'PLAN_GATED'
    action = 'upgrade'
  } else if (/unauthorized|access/i.test(typed.message ?? '')) {
    code = 'UNAUTHORIZED'
    action = 'check_report_access'
  }

  return {
    isError: true,
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        status: 'ERROR',
        error: {
          code,
          message: typed.message || 'FixFlags could not complete this task.',
          recoverable: code !== 'UNAUTHORIZED',
          action,
        },
      }),
    }],
  }
}

function taskResult(outcome: object, queue: {
  delayMs: number
  queued: boolean
  queueReason?: 'rate_limit' | 'backlog'
  queue: QueueStatus
  rateLimitRetryAfter: number
}) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        ...outcome,
        rateLimitRetryAfter: queue.rateLimitRetryAfter,
        queued: queue.queued,
        queueReason: queue.queueReason,
        queue: queue.queue,
      }),
    }],
  }
}

export function registerTaskTools(
  server: McpServer,
  user: User,
  options?: { signal?: AbortSignal }
): void {
  server.tool(
    MCP_TOOLS.checkAndPlan.name,
    MCP_TOOLS.checkAndPlan.desc,
    {
      url: z.string(),
      waitForCompletion: z.boolean().optional().describe('Poll until complete (max 50s)'),
      tool: z.enum(PROMPT_TOOL_KEYS).optional(),
      mode: z.enum(['single', 'critical_path']).optional(),
      scanAccess: scanAccessInputSchema.optional(),
    },
    async ({ url, waitForCompletion, tool, mode, scanAccess }) => {
      try {
      const freshUser = await assertMcpAccess(user)
      const normalizedUrl = (await assertPublicAuditUrl(url)).toString()
      if (scanAccess && !canUseEphemeralScanAccess(freshUser)) {
        throw new Error('Preview scan access requires the Studio plan')
      }
      const resolvedScanAccess = scanAccess ? parseScanAccessInput(scanAccess) : null
      const [userLimit, hostLimit, workerEstimate] = await Promise.all([
        recordRateLimit({
          scope: 'mcp-user', identifier: freshUser.id, limit: 60, windowSeconds: 3600,
          onRedisDown: 'reject',
        }),
        recordRateLimit({
          scope: 'audit-host',
          identifier: new URL(normalizedUrl).hostname,
          limit: 20,
          windowSeconds: 3600,
          onRedisDown: 'reject',
        }),
        getWorkerQueueEstimate(),
      ])
      const rateLimitRetryAfter = Math.max(
        userLimit.exceeded ? userLimit.retryAfterSeconds : 0,
        hostLimit.exceeded ? hostLimit.retryAfterSeconds : 0
      )
      const queue = computeEnqueueDelay(rateLimitRetryAfter, workerEstimate)
      const outcome = await checkAndPlan({
        url: normalizedUrl,
        userId: freshUser.id,
        auditMode: mode === 'single' ? 'SINGLE' : 'CRITICAL_PATH',
        delayMs: queue.delayMs,
        waitForCompletion,
        tool,
        signal: options?.signal,
        attribution: buildAttribution({ url: normalizedUrl, source: 'MCP' }),
        scanAccess: resolvedScanAccess,
      })
      return taskResult(outcome, {
        ...queue,
        rateLimitRetryAfter,
      })
      } catch (error) {
        return taskError(error)
      }
    }
  )

  server.tool(
    MCP_TOOLS.recheckAndCompare.name,
    MCP_TOOLS.recheckAndCompare.desc,
    {
      parentReportId: z.string(),
      waitForCompletion: z.boolean().optional(),
      tool: z.enum(PROMPT_TOOL_KEYS).optional(),
    },
    async ({ parentReportId, waitForCompletion, tool }) => {
      try {
      const freshUser = await assertMcpAccess(user)
      const [userLimit, workerEstimate] = await Promise.all([
        recordRateLimit({
          scope: 'mcp-user', identifier: freshUser.id, limit: 60, windowSeconds: 3600,
          onRedisDown: 'reject',
        }),
        getWorkerQueueEstimate(),
      ])
      const rateLimitRetryAfter = userLimit.exceeded ? userLimit.retryAfterSeconds : 0
      const queue = computeEnqueueDelay(rateLimitRetryAfter, workerEstimate)
      const outcome = await recheckAndCompare({
        parentReportId,
        user: freshUser,
        delayMs: queue.delayMs,
        waitForCompletion,
        tool,
        signal: options?.signal,
      })
      return taskResult(outcome, {
        ...queue,
        rateLimitRetryAfter,
      })
      } catch (error) {
        return taskError(error)
      }
    }
  )
}
