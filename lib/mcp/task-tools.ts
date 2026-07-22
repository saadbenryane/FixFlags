import type { User } from '@prisma/client'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { checkAndPlan, recheckAndCompare } from '@/lib/audit/task-contracts'
import { assertMcpAccess } from '@/lib/mcp/access'
import { recordRateLimit } from '@/lib/security/rate-limit'
import { computeEnqueueDelay, getWorkerQueueEstimate } from '@/lib/queue/estimate'
import { buildAttribution } from '@/lib/leads/attribution'
import { assertPublicAuditUrl } from '@/lib/audit/url'

function taskResult(outcome: object, queue: {
  delayMs: number
  estimatedWaitSeconds: number
  queuePosition: number
  scheduledStartAt: string | null
  rateLimitRetryAfter: number
  waitingJobs: number
}) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        ...outcome,
        estimatedWaitSeconds: queue.estimatedWaitSeconds,
        rateLimitRetryAfter: queue.rateLimitRetryAfter,
        queuePosition: queue.queuePosition,
        scheduledStartAt: queue.scheduledStartAt,
        queued: queue.delayMs > 0 || queue.waitingJobs > 0,
        queueReason:
          queue.delayMs > 0 ? 'rate_limit' : queue.waitingJobs > 0 ? 'backlog' : undefined,
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
    'ff_check_and_plan',
    'Check a URL and return its report plus the current three-item Finish Plan.',
    {
      url: z.string().url(),
      waitForCompletion: z.boolean().optional().describe('Poll until complete (max 90s)'),
      mode: z.enum(['single', 'critical_path']).optional(),
    },
    async ({ url, waitForCompletion, mode }) => {
      const freshUser = await assertMcpAccess(user)
      const normalizedUrl = (await assertPublicAuditUrl(url)).toString()
      const [userLimit, hostLimit, workerEstimate] = await Promise.all([
        recordRateLimit({
          scope: 'mcp-user', identifier: freshUser.id, limit: 60, windowSeconds: 3600,
        }),
        recordRateLimit({
          scope: 'audit-host',
          identifier: new URL(normalizedUrl).hostname,
          limit: 20,
          windowSeconds: 3600,
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
        signal: options?.signal,
        attribution: buildAttribution({ url: normalizedUrl, source: 'MCP' }),
      })
      return taskResult(outcome, {
        ...queue,
        rateLimitRetryAfter,
        waitingJobs: workerEstimate.waitingJobs,
      })
    }
  )

  server.tool(
    'ff_recheck_and_compare',
    'Run a fresh full re-check and return the verification diff plus next Finish Plan.',
    {
      parentReportId: z.string(),
      waitForCompletion: z.boolean().optional(),
    },
    async ({ parentReportId, waitForCompletion }) => {
      const freshUser = await assertMcpAccess(user)
      const [userLimit, workerEstimate] = await Promise.all([
        recordRateLimit({
          scope: 'mcp-user', identifier: freshUser.id, limit: 60, windowSeconds: 3600,
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
        signal: options?.signal,
      })
      return taskResult(outcome, {
        ...queue,
        rateLimitRetryAfter,
        waitingJobs: workerEstimate.waitingJobs,
      })
    }
  )
}
