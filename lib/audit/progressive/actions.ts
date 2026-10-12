import { z } from 'zod'
import { randomUUID } from 'node:crypto'
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
import { flagSchema, commitFindings, commitCheckReceipt } from './results'
import { executionWrite } from '../execution-ownership'
import { serializeFlowData } from '../flow/flow-url'
import type { TaskHandler } from './registry'
import { runTrackingChecks } from '../checks/tracking'
import { trackingEvidenceSchema } from '../tracking/contracts'
import { checkReceiptSchema } from '../checks/receipt'
import { resolveAuditPipelineMode } from '../pipeline/mode'
import { probeFormValidation } from '../flow/form-probes'
import { formEvidenceSchema } from '../flow/form-evidence'
import { checkFormValidation } from '../checks/form-validation'
import { prisma } from '@/lib/db'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { runOverlayBlockerChecks } from '../checks/overlay'

const flowSchema = z.object({ tracking: trackingEvidenceSchema.optional(), receipt: checkReceiptSchema.optional(),
  formReceipt: checkReceiptSchema.optional(), formEvidence: formEvidenceSchema.optional(), flags: z.array(flagSchema).max(500), result: z.object({
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
    validateResult: artifact => { flowSchema.parse(artifact.data) },
    async commit(context, artifact, tx) {
      const { receipt, formReceipt } = flowSchema.parse(artifact.data)
      if (receipt) await commitCheckReceipt(context, receipt, tx, ':phase:public_action')
      if (formReceipt) await commitCheckReceipt(context, formReceipt, tx)
      await commitFindings(context, artifact, tx)
    },
    async evaluate(context) {
      if (context.input.module === 'form-validation') {
        const token = randomUUID(), deadline = Math.min(context.deadline, Date.now() + 10_000)
        const spec = readExecutionSpec(context.audit.executionSpec), target = spec?.verificationTarget
        const sources = target?.kind === 'DIAGNOSTIC' && context.audit.projectId
          ? await prisma.flag.findMany({ where: { auditId: target.parentAuditId, audit: { projectId: context.audit.projectId }, checkId: target.checkId },
              take: 100, select: { evidenceTargets: true } }) : []
        const expectedTargets = sources.flatMap(source => Array.isArray(source.evidenceTargets) ? source.evidenceTargets.flatMap(value => {
          const parsed = z.object({ context: z.string().startsWith('form:').max(160), selector: z.string().min(1).max(2000), label: z.string().min(1).max(160) }).safeParse(value)
          return parsed.success ? [parsed.data] : []
        }) : [])
        let active = false, safetyRefused = false
        const session = await createAuditPage(await getAuditBrowser(), context.input.pageUrl, {
          profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, localFormValidationToken: token,
          scanAccess: await resolveAuditScanAccess(context.audit.id), deadline,
          allowLocalhost: process.env.NODE_ENV !== 'production' && process.env.DEV_ALLOW_LOCALHOST === 'true',
          onSafetyRefusal: () => { if (active) safetyRefused = true },
        })
        try {
          active = true
          const probe = await probeFormValidation(session.page, { isolated: true, localValidationToken: token, deadline,
            safetyRefused: () => safetyRefused, expectedTargets, unavailableDependencies: session.safetyRestrictions.length > 0 })
          const checked = checkFormValidation(probe.evidence)
          const overlays = runOverlayBlockerChecks('form', probe.formOverlay, probe.formLabel).map(flag => ({ ...flag, pageUrl: probe.evidence?.pageUrl ?? context.input.pageUrl }))
          return serializeArtifact('flow', flowSchema.parse({ flags: [...checked.flags, ...overlays], formEvidence: probe.evidence,
            result: { status: 'success', steps: [], finalUrl: session.page.url(), ctaText: null, ctaHref: null },
            formReceipt: { kind: 'site-module-check', version: 1, module: 'form-validation', pageUrl: probe.evidence?.pageUrl ?? context.input.pageUrl,
              applicable: checked.applicable, complete: checked.complete, passed: checked.complete && checked.flags.length === 0,
              assertions: checked.assertions, ...(!checked.complete ? { limitation: 'Empty-field form validation could not be observed safely.' } : {}),
              execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() },
            } }))
        } finally { session.disposeNetwork(); await session.page.context().close() }
      }
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
        session.setTrackingPhase('public_action')
        const result: FlowScanResult = await runFlowScan(session.page,
          context.audit.id, context.input.pageUrl,
          { pageKey: 'p' + context.input.position + '-g' + context.task.workGeneration, deadlineMs: Math.max(1, context.deadline - Date.now()),
            fetchHeaders: scanAccessToFetchHeaders(access), includeFormValidation: false })
        if (protectedActionRefused) throw new TaskFailure('PROTECTED_ACTION_REQUIRES_FIXTURE', false)
        if (result.status === 'skipped') throw new TaskFailure('FLOW_EXECUTION_UNAVAILABLE', true, undefined, true)
        const tracking = session.tracking('public_action')
        const measured = runTrackingChecks(metadata, tracking, context.input.pageUrl)
        const flags = [...measured.flags, ...runFlowChecks(result, detectPagePurpose(metadata, context.input.pageUrl).purpose),
          ...runNetworkEngagementChecks(session.networkFailures, session.formProbe)].map(flag => ({ ...flag, pageUrl: context.input.pageUrl }))
        if (context.input.primary) await executionWrite(tx => tx.audit.update({ where: { id: context.audit.id }, data: { flowData: serializeFlowData(result) as never } }))
        return serializeArtifact('flow', flowSchema.parse({ flags, result: serializeFlowData(result), tracking, receipt: {
          kind: 'site-module-check', version: 1, module: 'measurement', pageUrl: context.input.pageUrl, applicable: true,
          passed: measured.flags.length === 0 && measured.complete, complete: measured.complete, limitation: measured.limitation, assertions: measured.assertions,
          execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() },
        } }))
      } finally { session.disposeNetwork(); await session.page.context().close() }
    },
  },
  { kind: 'slow-replay', replay: 'read_only', timeoutMs: 45_000,
    validateResult: artifact => { slowSchema.parse(artifact.data) }, commit: commitFindings,
    async evaluate(context) {
      if (await resolveAuditPipelineMode(context.audit.id) === 'TEASER') throw new TaskFailure('SLOW_REPLAY_NOT_APPLICABLE', false)
      if (!browserEvidence(context)?.metadata) throw new TaskFailure('SLOW_REPLAY_PAGE_UNAVAILABLE', false)
      const result = await runSlowReplay(await getAuditBrowser(), context.audit.id, context.input.pageUrl,
        { deadline: context.deadline, pageKey: 'p' + context.input.position + '-g' + context.task.workGeneration, scanAccess: await resolveAuditScanAccess(context.audit.id) })
      if (!result.complete) throw new TaskFailure('SLOW_REPLAY_INTERRUPTED', true, undefined, true)
      return serializeArtifact('slow-replay', slowSchema.parse({ result, flags: runSlowReplayChecks(result).map(flag => ({ ...flag, pageUrl: context.input.pageUrl })) }))
    },
  },
]
