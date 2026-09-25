import { prisma } from '@/lib/db'
import { executeProductCommand } from '@/lib/products/application/commands'
import { confirmPageAvailability, confirmSiteOutcome } from '@/lib/sites/outcomes'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { findReusableRun, requestOutcomeRun, requestSiteRun } from '@/lib/sites/application/run-requests'

export type SiteCommand =
  | {
      type: 'CONFIRM_PAGE_AVAILABILITY'
      siteId: string
    }
  | {
      type: 'CONFIRM_OUTCOME'
      siteId: string
      outcomeId: string
      name?: string
      confirmed: boolean
      kind?: 'CHECKOUT' | 'SIGNUP' | 'AVAILABILITY'
    }
  | {
      type: 'RECORD_FIX_HANDOFF'
      flagId: string
      userId: string
      builder: string
    }
  | {
      type: 'VERIFY_FLAG'
      siteId: string
      userId: string
      flagId: string
      idempotencyKey?: string
      source?: 'WEB' | 'MCP'
    }
  | {
      type: 'SET_WATCH'
      siteId: string
      userId: string
      interval: 'weekly' | 'daily' | null
    }

export async function executeSiteCommand(command: SiteCommand) {
  switch (command.type) {
    case 'CONFIRM_PAGE_AVAILABILITY': {
      const site = await loadSiteRecord(command.siteId)
      if (!site) return { ok: false as const, error: 'Site not found' }
      const outcome = await confirmPageAvailability(site)
      if (!outcome) return { ok: false as const, error: 'Outcome not found' }
      return { ok: true as const, outcome }
    }
    case 'CONFIRM_OUTCOME': {
      const site = await loadSiteRecord(command.siteId)
      if (!site) return { ok: false as const, error: 'Site not found' }
      const outcome = await confirmSiteOutcome({
        site,
        outcomeId: command.outcomeId,
        name: command.name,
        confirmed: command.confirmed,
        kind: command.kind,
      })
      if (!outcome) return { ok: false as const, error: 'Outcome not found' }
      return { ok: true as const, outcome }
    }
    case 'RECORD_FIX_HANDOFF': {
      await executeProductCommand({
        type: 'RECORD_FLAG_ACTION',
        flagId: command.flagId,
        userId: command.userId,
        builder: command.builder,
        action: 'HANDOFF_COPIED',
      })
      await recordSiteLifecycleEvent({
        name: 'fix_handoff',
        idempotencyKey: `fix-handoff:${command.userId}:${command.flagId}:${command.builder}`,
        userId: command.userId,
        properties: { channel: command.builder },
      })
      return { ok: true as const }
    }
    case 'VERIFY_FLAG': {
      const site = await loadSiteRecord(command.siteId)
      if (!site?.projectId) {
        return { ok: false as const, error: 'Claim this Site before verifying a fix.' }
      }
      const flag = await loadSiteFlagDetail(site, command.flagId)
      if (!flag) return { ok: false as const, error: 'Flag not found' }
      const source = command.source ?? 'WEB'
      if (command.idempotencyKey && flag.outcomeId) {
        const reusable = await findReusableRun({
          projectId: site.projectId,
          source,
          idempotencyKey: command.idempotencyKey,
          outcomeIds: [flag.outcomeId],
        })
        if (reusable) {
          return {
            ok: true as const,
            runId: reusable.runId,
            verificationAuditId: reusable.auditId,
            siteId: site.siteId,
            parentAuditId: flag.sourceAuditId,
            flagId: flag.id,
            attemptId: null,
            expectedBehavior: flag.expectedBehavior,
          }
        }
      }

      const attempt = await executeProductCommand({
        type: 'RECORD_FLAG_ACTION',
        flagId: flag.id,
        userId: command.userId,
        builder: 'site-board',
        action: 'READY_TO_VERIFY',
        changeSummary: flag.expectedBehavior,
      })
      if (!attempt.attemptId) {
        return { ok: false as const, error: 'Could not prepare this verification attempt.' }
      }
      const idempotencyKey = command.idempotencyKey ?? `flag-verify:${attempt.attemptId}`

      if (flag.outcomeId) {
        const started = await requestOutcomeRun({
          projectId: site.projectId,
          outcomeId: flag.outcomeId,
          userId: command.userId,
          source,
          idempotencyKey,
          verificationAttemptId: attempt.attemptId,
          parentAuditId: flag.sourceAuditId,
          context: { action: 'verify_flag' },
        })
        await recordSiteLifecycleEvent({
          name: 'verify_started',
          idempotencyKey: `verify-started:${attempt.attemptId}`,
          userId: command.userId,
          projectId: site.projectId,
          properties: { reused: started.reused, scope: 'outcome' },
        })
        return {
          ok: true as const,
          runId: started.runId,
          verificationAuditId: started.auditId,
          siteId: site.siteId,
          parentAuditId: flag.sourceAuditId,
          flagId: flag.id,
          attemptId: attempt.attemptId,
          expectedBehavior: flag.expectedBehavior,
        }
      }

      const outcomes = await prisma.siteOutcome.findMany({
        where: { projectId: site.projectId, enabled: true },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
      if (outcomes.length === 0) {
        return { ok: false as const, error: 'Confirm an Outcome before verifying this Flag.' }
      }
      const started = await requestSiteRun({
        projectId: site.projectId,
        outcomeIds: outcomes.map((outcome) => outcome.id),
        userId: command.userId,
        source,
        idempotencyKey,
        verificationAttemptId: attempt.attemptId,
        parentAuditId: flag.sourceAuditId,
        url: flag.pageUrl || site.url,
        context: { action: 'verify_flag' },
      })
      await recordSiteLifecycleEvent({
        name: 'verify_started',
        idempotencyKey: `verify-started:${attempt.attemptId}`,
        userId: command.userId,
        projectId: site.projectId,
        properties: { reused: started.reused, scope: 'site' },
      })

      return {
        ok: true as const,
        runId: started.runId,
        verificationAuditId: started.auditId,
        siteId: site.siteId,
        parentAuditId: flag.sourceAuditId,
        flagId: flag.id,
        attemptId: attempt.attemptId,
        expectedBehavior: flag.expectedBehavior,
      }
    }
    case 'SET_WATCH': {
      const site = await loadSiteRecord(command.siteId)
      if (!site?.projectId) {
        return { ok: false as const, error: 'Claim this Site before Keep watching.' }
      }
      const result = await executeProductCommand({
        type: 'SET_WATCH',
        projectId: site.projectId,
        userId: command.userId,
        interval: command.interval,
      })
      if (result.ok && command.interval) {
        await recordSiteLifecycleEvent({
          name: 'watch_enabled',
          idempotencyKey: `watch-enabled:${site.projectId}:${command.interval}`,
          userId: command.userId,
          projectId: site.projectId,
          properties: { interval: command.interval },
        })
      }
      return result
    }
  }
}
