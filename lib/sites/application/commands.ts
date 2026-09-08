import { executeProductCommand } from '@/lib/products/application/commands'
import { confirmSiteOutcome } from '@/lib/sites/outcomes'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'

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
      sourceAuditId: string
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
      return { ok: true as const }
    }
    case 'VERIFY_FLAG': {
      const site = await loadSiteRecord(command.siteId)
      if (!site?.projectId) {
        return { ok: false as const, error: 'Claim this Site before verifying a fix.' }
      }
      const started = await createAndEnqueueAudit({
        url: site.url,
        userId: command.userId,
        parentId: command.sourceAuditId,
        recheckTrigger: 'MANUAL',
        useProjectScanAccess: true,
      })
      // Targeted verify reuses a fresh analysis; reconciliation runs when complete.
      return {
        ok: true as const,
        verificationAuditId: started.auditId,
        siteId: site.siteId,
        parentAuditId: command.sourceAuditId,
      }
    }
    case 'SET_WATCH': {
      const site = await loadSiteRecord(command.siteId)
      if (!site?.projectId) {
        return { ok: false as const, error: 'Claim this Site before Keep watching.' }
      }
      return executeProductCommand({
        type: 'SET_WATCH',
        projectId: site.projectId,
        userId: command.userId,
        interval: command.interval,
      })
    }
  }
}
