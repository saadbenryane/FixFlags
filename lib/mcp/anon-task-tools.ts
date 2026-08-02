import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { checkAndPlan } from '@/lib/audit/task-contracts'
import { recordRateLimit } from '@/lib/security/rate-limit'
import {
  computeEnqueueDelay,
  getWorkerQueueEstimate,
  type QueueStatus,
} from '@/lib/queue/estimate'
import { buildAttribution } from '@/lib/leads/attribution'
import { assertPublicAuditUrl } from '@/lib/audit/url'
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

export function registerAnonTaskTools(
  server: McpServer,
  options?: { signal?: AbortSignal }
): void {
  server.tool(
    MCP_TOOLS.checkAndPlan.name,
    MCP_TOOLS.checkAndPlan.desc,
    {
      url: z.string(),
      waitForCompletion: z.boolean().optional().describe('Poll until complete (max 50s)'),
      tool: z.enum(PROMPT_TOOL_KEYS).optional(),
    },
    async ({ url, waitForCompletion, tool }) => {
      try {
        const normalizedUrl = (await assertPublicAuditUrl(url)).toString()
        const [hostLimit, workerEstimate] = await Promise.all([
          recordRateLimit({
            scope: 'audit-host',
            identifier: new URL(normalizedUrl).hostname,
            limit: 10,
            windowSeconds: 3600,
            onRedisDown: 'reject',
          }),
          getWorkerQueueEstimate(),
        ])
        const rateLimitRetryAfter = hostLimit.exceeded ? hostLimit.retryAfterSeconds : 0
        const queue = computeEnqueueDelay(rateLimitRetryAfter, workerEstimate)
        const outcome = await checkAndPlan({
          url: normalizedUrl,
          userId: null,
          auditMode: 'CRITICAL_PATH',
          delayMs: queue.delayMs,
          waitForCompletion,
          tool,
          signal: options?.signal,
          attribution: buildAttribution({ url: normalizedUrl, source: 'MCP' }),
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
