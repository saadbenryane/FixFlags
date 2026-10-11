import { z } from 'zod'
import { getAuditBrowser } from '../screenshot'
import { createAuditPage } from '../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../browser/capture-profile'
import { resolveAuditScanAccess } from '../scan-access-store'
import { scanAccessToFetchHeaders } from '../scan-access'
import { runFlowScan, type FlowScanResult } from '../flow/run-flow-scan'
import { runFlowChecks } from '../checks/flow'
import { runNetworkEngagementChecks } from '../checks/network-engagement'
import { detectPagePurpose } from '../page-purpose'
import { runSlowReplay } from '../flow/slow-replay-probe'
import { runSlowReplayChecks } from '../checks/slow-replay'
import { browserEvidence } from './evaluators'
import { serializeArtifact, TaskFailure } from './contracts'
import { flagSchema, commitFindings } from './results'
import { executionWrite } from '../execution-ownership'
import { serializeFlowData } from '../flow/flow-url'
import type { TaskHandler } from './registry'
import { resolveAuditPipelineMode } from '../pipeline/mode'

const flowSchema = z.object({ flags: z.array(flagSchema).max(500), result: z.object({
  status: z.enum(['success', 'no_cta', 'unclickable', 'error_response', 'dead_end', 'external_leave', 'skipped', 'timeout']),
  steps: z.array(z.object({ label: z.string(), screenshotUrl: z.string().nullable(), url: z.string() }).strict()).max(30),
  finalUrl: z.string().url(), ctaText: z.string().nullable(), ctaHref: z.string().nullable(),
}).strict() }).strict()
const slowSchema = z.object({ flags: z.array(flagSchema).max(500), result: z.object({
  timeToFirstTextMs: z.number().finite().nonnegative(), timeToCtaMs: z.number().finite().nonnegative(),
  screenshotUrls: z.array(z.string().url()).max(10), complete: z.boolean(),
}).strict() }).strict()

export const actionHandlers: TaskHandler[] = [
  { kind: 'flow', replay: 'read_only', timeoutMs: 40_000,
    validateResult: artifact => { flowSchema.parse(artifact.data) }, commit: commitFindings,
    async evaluate(context) {
      const metadata = browserEvidence(context)?.metadata
      if (!metadata) throw new TaskFailure('FLOW_PAGE_UNAVAILABLE', false)
      const access = await resolveAuditScanAccess(context.audit.id)
      let protectedActionRefused = false
      const session = await createAuditPage(await getAuditBrowser(), context.input.pageUrl, {
        profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, scanAccess: access, deadline: context.deadline,
        allowLocalhost: process.env.NODE_ENV !== 'production' && process.env.DEV_ALLOW_LOCALHOST === 'true',
        onSafetyRefusal: reason => { if (reason === 'protected_action_requires_fixture') protectedActionRefused = true },
      })
      try {
        const result: FlowScanResult = await runFlowScan(session.page,
          context.audit.id, context.input.pageUrl,
          { pageKey: 'p0-g' + context.task.workGeneration, deadlineMs: Math.max(1, context.deadline - Date.now()), fetchHeaders: scanAccessToFetchHeaders(access) })
        if (protectedActionRefused) throw new TaskFailure('PROTECTED_ACTION_REQUIRES_FIXTURE', false)
        if (result.status === 'skipped') throw new TaskFailure('FLOW_EXECUTION_UNAVAILABLE', true, undefined, true)
        const flags = [...runFlowChecks(result, detectPagePurpose(metadata, context.input.pageUrl).purpose),
          ...runNetworkEngagementChecks(session.networkFailures, session.formProbe)].map(flag => ({ ...flag, pageUrl: context.input.pageUrl }))
        await executionWrite(tx => tx.audit.update({ where: { id: context.audit.id }, data: { flowData: serializeFlowData(result) as never } }))
        return serializeArtifact('flow', flowSchema.parse({ flags, result: serializeFlowData(result) }))
      } finally { session.disposeNetwork(); await session.page.context().close() }
    },
  },
  { kind: 'slow-replay', replay: 'read_only', timeoutMs: 45_000,
    validateResult: artifact => { slowSchema.parse(artifact.data) }, commit: commitFindings,
    async evaluate(context) {
      if (await resolveAuditPipelineMode(context.audit.id) === 'TEASER') throw new TaskFailure('SLOW_REPLAY_NOT_APPLICABLE', false)
      if (!browserEvidence(context)?.metadata) throw new TaskFailure('SLOW_REPLAY_PAGE_UNAVAILABLE', false)
      const result = await runSlowReplay(await getAuditBrowser(), context.audit.id, context.input.pageUrl,
        { deadline: context.deadline, pageKey: 'p0-g' + context.task.workGeneration, scanAccess: await resolveAuditScanAccess(context.audit.id) })
      if (!result.complete) throw new TaskFailure('SLOW_REPLAY_INTERRUPTED', true, undefined, true)
      return serializeArtifact('slow-replay', slowSchema.parse({ result, flags: runSlowReplayChecks(result).map(flag => ({ ...flag, pageUrl: context.input.pageUrl })) }))
    },
  },
]
