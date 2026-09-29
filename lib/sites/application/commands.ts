import { executeProductCommand } from '@/lib/products/application/commands'
import { confirmPageAvailability, confirmSiteOutcome } from '@/lib/sites/outcomes'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { findReusableRun, requestOutcomeRun, requestSiteRun } from '@/lib/sites/application/run-requests'
import { recordSiteFlagFix, requireSiteFlagAttempt } from '@/lib/sites/application/flag-verification'
import { OUTCOME_CONFIRMATION } from '@/lib/marketing/copy'

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
      attemptId?: string
      changeSummary?: string
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
      // A kind is the execution mechanism that will verify the Outcome, not a
      // label. Confirming without one writes an agreement FixFlags can never
      // verify, and leaves the Outcome kind 'GENERIC', which the Site surfaces
      // filter out. The customer would have confirmed something and seen no
      // change, forever. Refuse it and say what is missing.
      if (command.confirmed && !command.kind) {
        return {
          ok: false as const,
          error: OUTCOME_CONFIRMATION.kindRequired,
          code: 'OUTCOME_KIND_REQUIRED' as const,
        }
      }
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
      const initialSite = await loadSiteRecord(command.siteId)
      if (!initialSite?.projectId) return { ok: false as const, error: 'Claim this Site before verifying a fix.' }
      const initialFlag = await loadSiteFlagDetail(initialSite, command.flagId)
      if (!initialFlag) return { ok: false as const, error: 'Flag not found' }
      const source = command.source ?? 'WEB'
      if (command.idempotencyKey && initialFlag.outcomeId) {
        const reusable = await findReusableRun({
          projectId: initialSite.projectId,
          source,
          idempotencyKey: command.idempotencyKey,
          outcomeIds: [initialFlag.outcomeId],
        })
        if (reusable) {
          return {
            ok: true as const,
            runId: reusable.runId,
            verificationAuditId: reusable.auditId,
            siteId: initialSite.siteId,
            parentAuditId: initialFlag.sourceAuditId,
            flagId: initialFlag.id,
            attemptId: null,
            expectedBehavior: initialFlag.expectedBehavior,
          }
        }
      }

      const recorded = command.attemptId
        ? { attemptId: command.attemptId }
        : await recordSiteFlagFix({
            siteId: command.siteId,
            flagId: command.flagId,
            userId: command.userId,
            idempotencyKey: command.idempotencyKey ?? `web-fix:${command.flagId}`,
            changeSummary: command.changeSummary ?? initialFlag.expectedBehavior,
            client: source.toLowerCase(),
          })
      const { site, flag, attemptId } = await requireSiteFlagAttempt({
        siteId: command.siteId,
        flagId: command.flagId,
        attemptId: recorded.attemptId,
        userId: command.userId,
      })
      const idempotencyKey = command.idempotencyKey ?? `flag-verify:${attemptId}`

      if (flag.outcomeId) {
        const started = await requestOutcomeRun({
          projectId: site.projectId!,
          outcomeId: flag.outcomeId,
          userId: command.userId,
          source,
          idempotencyKey,
          verificationAttemptId: attemptId,
          parentAuditId: flag.sourceAuditId,
          verificationTarget: {
            kind: 'OUTCOME',
            outcomeId: flag.outcomeId,
            attemptId,
            parentAuditId: flag.sourceAuditId,
          },
          context: { action: 'verify_flag' },
        })
        await recordSiteLifecycleEvent({
          name: 'verify_started',
          idempotencyKey: `verify-started:${attemptId}`,
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
          attemptId,
          expectedBehavior: flag.expectedBehavior,
        }
      }

      if (!flag.pageUrl || !flag.checkId) {
        return { ok: false as const, error: 'This Flag has no comparable source scope to verify.' }
      }
      const started = await requestSiteRun({
        projectId: site.projectId!,
        outcomeIds: [],
        userId: command.userId,
        source,
        idempotencyKey,
        verificationTarget: {
          kind: 'DIAGNOSTIC',
          pageUrl: flag.pageUrl,
          checkId: flag.checkId,
          attemptId,
          parentAuditId: flag.sourceAuditId,
        },
        context: { action: 'verify_flag' },
      })
      await recordSiteLifecycleEvent({
        name: 'verify_started',
        idempotencyKey: `verify-started:${attemptId}`,
        userId: command.userId,
        projectId: site.projectId,
        properties: { reused: started.reused, scope: 'diagnostic' },
      })

      return {
        ok: true as const,
        runId: started.runId,
        verificationAuditId: started.auditId,
        siteId: site.siteId,
        parentAuditId: flag.sourceAuditId,
        flagId: flag.id,
        attemptId,
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
