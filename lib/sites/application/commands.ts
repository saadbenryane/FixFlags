import { executeProductCommand } from '@/lib/products/application/commands'
import { confirmSiteOutcome } from '@/lib/sites/outcomes'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'

export type SiteCommand =
  | {
      type: 'CONFIRM_OUTCOME'
      siteId: string
      outcomeId: string
      name?: string
      confirmed: boolean
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
    }
  | {
      type: 'SET_WATCH'
      siteId: string
      userId: string
      interval: 'weekly' | 'daily' | null
    }

export async function executeSiteCommand(command: SiteCommand) {
  switch (command.type) {
    case 'CONFIRM_OUTCOME': {
      const site = await loadSiteRecord(command.siteId)
      if (!site) return { ok: false as const, error: 'Site not found' }
      const outcome = await confirmSiteOutcome({
        site,
        outcomeId: command.outcomeId,
        name: command.name,
        confirmed: command.confirmed,
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

      const verifyUrl = flag.pageUrl || site.url
      const started = await createAndEnqueueAudit({
        url: verifyUrl,
        userId: command.userId,
        parentId: flag.sourceAuditId,
        recheckTrigger: 'MANUAL',
        auditMode: flag.checkId?.startsWith('journey-') ? 'CRITICAL_PATH' : 'SINGLE',
        skipUsageCount: true,
        useProjectScanAccess: true,
        verificationAttemptId: attempt.attemptId,
      })
      await recordSiteLifecycleEvent({
        name: 'verify_started',
        idempotencyKey: `verify-started:${attempt.attemptId}`,
        userId: command.userId,
        projectId: site.projectId,
        properties: { reused: started.reused, scope: flag.checkId?.startsWith('journey-') ? 'journey' : 'page' },
      })

      return {
        ok: true as const,
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
