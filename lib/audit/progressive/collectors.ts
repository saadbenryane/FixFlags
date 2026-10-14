import { RENDERED_HTML_LIMIT } from '../browser/rendered-html'
import { Prisma } from '@prisma/client'
import { executionTransaction } from '../execution-ownership'
import { captureScreenshots } from '../screenshot'
import { mergeRuntimeHeadMetadata, trimMetadataForStorage } from '../metadata'
import { collectDocument, collectSiteResources, missingDocument } from '../search/collect'
import { resolveAuditScanAccess } from '../scan-access-store'
import { fetchPageSpeedData, toStoredPageSpeedResult } from '../pagespeed'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '../viewports'
import { httpArtifactSchema, browserArtifactSchema, captureArtifactSchema, speedArtifactSchema, resourceArtifactSchema } from './snapshots'
import { serializeArtifact, readArtifact, TaskFailure } from './contracts'
import type { TaskHandler } from './registry'
import { parseMetadataIsolated } from './cpu'
import { getAuditBrowser } from '../screenshot'
import { createAuditPage } from '../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE, MOBILE_CAPTURE_PROFILE } from '../browser/capture-profile'
import { collectKeyboardEvidence, keyboardEvidenceSchema } from '../browser/keyboard-probe'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { motionObservationSchema, motionRequested } from '../checks/motion-evidence'
import { collectReducedMotionWindow } from '../browser/motion-observation'
import { captureAccessKey, captureProfileKey } from '../browser/observation-scope'

export const collectionHandlers: TaskHandler[] = [
  { kind: 'motion', replay: 'read_only', timeoutMs: 45_000,
    validateResult: artifact => { motionObservationSchema.parse(artifact.data) },
    async evaluate(context) {
      const browser = [...context.dependencies.values()].find(task => task.workKind === 'browser' && task.workState === 'COMPLETED')
      const captured = browser?.workResult ? browserArtifactSchema.parse(readArtifact(browser.workResult, 'browser').data) : null
      const before = captured?.snapshot.motionWindow
      if (!before) throw new TaskFailure('INITIAL_MOTION_EVIDENCE_UNAVAILABLE', false)
      const access = await resolveAuditScanAccess(context.audit.id)
      const after = await collectReducedMotionWindow(await getAuditBrowser(), context.input.pageUrl, { deadline: context.deadline, scanAccess: access })
      return serializeArtifact('motion', motionObservationSchema.parse({ version: 1,
        scope: { pageUrl: context.input.pageUrl, finalUrl: before.pageUrl, profile: captureProfileKey(MOBILE_CAPTURE_PROFILE), access: captureAccessKey(access, context.input.pageUrl) }, before, after }))
    },
  },
  { kind: 'keyboard', replay: 'read_only', timeoutMs: 30_000,
    validateResult: artifact => { keyboardEvidenceSchema.parse(artifact.data) },
    async evaluate(context) {
      let refused = 0
      const session = await createAuditPage(await getAuditBrowser(), context.input.pageUrl, {
        profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, readOnlyInteractions: true, deadline: context.deadline,
        scanAccess: await resolveAuditScanAccess(context.audit.id),
        onSafetyRefusal: () => { refused++ },
      })
      try {
        const evidence = await collectKeyboardEvidence(session.page, Math.min(context.deadline, Date.now() + 8000), { refusalCount: () => refused })
        return serializeArtifact('keyboard', keyboardEvidenceSchema.parse(evidence))
      } finally { session.disposeNetwork(); await session.page.context().close() }
    },
  },
  { kind: 'search-resources', replay: 'read_only', timeoutMs: 30_000,
    validateResult: artifact => { resourceArtifactSchema.parse(artifact.data) },
    async evaluate(context) {
      const origin = new URL(context.input.pageUrl).origin
      const robotsTask = [...context.dependencies.values()].find(task => task.workKind === 'search-resources' && task.workState === 'COMPLETED')
      const robots = robotsTask?.workResult ? resourceArtifactSchema.parse(readArtifact(robotsTask.workResult, 'search-resources').data).robots : undefined
      const resources = context.input.module === 'robots'
        ? { robots: await collectDocument(new URL('/robots.txt', origin).toString(), context.deadline, 512_000),
          sitemaps: [], sitemapUrls: [], complete: false, declaredSitemaps: [] }
        : await collectSiteResources(origin, context.deadline,
          robots ?? missingDocument(new URL('/robots.txt', origin).toString(), 'resource_collection_incomplete'))
      return serializeArtifact('search-resources', resourceArtifactSchema.parse(resources))
    },
  },
  { kind: 'http', replay: 'read_only', timeoutMs: 12_000,
    validateResult: artifact => { httpArtifactSchema.parse(artifact.data) },
    async evaluate(context) {
      // This collector observes only public responses. Credentialed captures remain isolated.
      const document = await collectDocument(context.input.pageUrl, context.deadline)
      if (document.status === null) throw new TaskFailure('HTTP_COLLECTION_UNAVAILABLE', true)
      const metadata = document.status >= 200 && document.status < 300 && document.complete && document.body && /(?:text\/html|application\/xhtml\+xml)/i.test(document.headers['content-type'] ?? '')
        ? await parseMetadataIsolated(document.body, document.finalUrl, context.deadline) : null
      return serializeArtifact('http', httpArtifactSchema.parse({ document, metadata }))
    },
  },
  { kind: 'browser', replay: 'read_only', timeoutMs: 90_000,
    validateResult: artifact => { browserArtifactSchema.parse(artifact.data) },
    async evaluate(context) {
      const pageUrl = new URL(context.input.pageUrl).toString()
      const page = await executionTransaction(tx => tx.auditPage.upsert({
        where: { auditId_normalizedUrl: { auditId: context.audit.id, normalizedUrl: pageUrl } },
        create: { auditId: context.audit.id, url: pageUrl, normalizedUrl: pageUrl,
          position: context.input.position, role: context.input.role, status: 'CAPTURING' }, update: {},
      }))
      const access = await resolveAuditScanAccess(context.audit.id)
      const spec = readExecutionSpec(context.audit.executionSpec)
      const consoleObservationMs = spec?.consoleObservationScopes?.find(scope => new URL(scope.pageUrl).href === pageUrl)?.minimumMs ?? spec?.consoleObservationMs
      // DOM and semantics have no private-storage dependency. Media has its own
      // checkpoint and recovery window, so an upload outage cannot erase this input.
      const captured = await captureScreenshots(pageUrl, context.audit.id,
        `p${context.input.position}-g${context.task.workGeneration}`, { runFlow: false, scanAccess: access, deadline: context.deadline,
          collectOriginalDocument: false, captureMedia: false, consoleObservationMs, captureMotion: motionRequested(spec), deferMotionComparison: true })
      const htmlWithinBudget = captured.desktopHtml && Buffer.byteLength(captured.desktopHtml) <= RENDERED_HTML_LIMIT
      const metadata = htmlWithinBudget ? mergeRuntimeHeadMetadata(await parseMetadataIsolated(captured.desktopHtml!, captured.desktopFinalUrl ?? pageUrl, context.deadline), captured.runtimeHeadMetadata) : null
      if (!metadata && !captured.desktopHtml && !captured.desktopHtmlTruncated && !captured.captureFailures?.some(failure => ['HTTP_ERROR', 'HTTP_FORBIDDEN', 'HTTP_RATE_LIMIT', 'NON_HTML_RESPONSE'].includes(failure.code)))
        throw new TaskFailure('BROWSER_COLLECTION_INTERRUPTED', true, undefined, true)
      await executionTransaction(async tx => {
        await tx.auditPage.update({ where: { id: page.id }, data: {
          status: metadata ? 'CHECKING' : 'FAILED', title: metadata?.title,
          ...(metadata ? { htmlMetadata: trimMetadataForStorage(metadata) as never } : {}),
          consoleErrors: captured.consoleErrors as Prisma.InputJsonValue,
          ...(!metadata ? { failureCode: 'BROWSER_SCOPE_UNAVAILABLE', failureMessage: 'Rendered content could not be inspected. Public response results remain available.' } : {}),
        } })
        if (context.input.primary && metadata) await tx.audit.update({ where: { id: context.audit.id }, data: {
          htmlMetadata: trimMetadataForStorage(metadata) as never, consoleErrors: captured.consoleErrors as Prisma.InputJsonValue,
        } })
      })
      // Secret-bearing original/rendered HTML never enters the durable public collector snapshot.
      const snapshot = { ...captured }
      delete snapshot.flowResult
      return serializeArtifact('browser', browserArtifactSchema.parse({ pageId: page.id, metadata,
        snapshot: { ...snapshot, desktopBase64: null, mobileBase64: null,
          ...(!htmlWithinBudget ? { desktopHtml: null } : {}),
          ...(access ? { desktopHtml: null, originalDocument: undefined } : {}) } }))
    },
  },
  { kind: 'captures', replay: 'read_only', timeoutMs: 90_000,
    validateResult: artifact => { captureArtifactSchema.parse(artifact.data) },
    async evaluate(context) {
      const pageUrl = new URL(context.input.pageUrl).toString()
      const page = await executionTransaction(tx => tx.auditPage.upsert({
        where: { auditId_normalizedUrl: { auditId: context.audit.id, normalizedUrl: pageUrl } },
        create: { auditId: context.audit.id, url: pageUrl, normalizedUrl: pageUrl,
          position: context.input.position, role: context.input.role, status: 'CAPTURING' }, update: {},
      }))
      const captured = await captureScreenshots(pageUrl, context.audit.id,
        `capture-p${context.input.position}-g${context.task.workGeneration}`, {
          runFlow: false, scanAccess: await resolveAuditScanAccess(context.audit.id), deadline: context.deadline,
          collectOriginalDocument: false, mediaOnly: true,
        })
      await executionTransaction(async tx => {
        for (const capture of [
          { device: 'DESKTOP' as const, url: captured.desktopUrl, viewport: DESKTOP_VIEWPORT },
          { device: 'MOBILE' as const, url: captured.mobileUrl, viewport: MOBILE_VIEWPORT },
        ]) if (capture.url) {
          const exists = await tx.screenshot.findFirst({ where: { auditId: context.audit.id, pageId: page.id,
            device: capture.device, url: capture.url }, select: { id: true } })
          if (!exists) await tx.screenshot.create({ data: { auditId: context.audit.id, pageId: page.id,
            device: capture.device, url: capture.url, width: capture.viewport.width, height: capture.viewport.height } })
        }
      })
      const snapshot = { ...captured }; delete snapshot.flowResult
      return serializeArtifact('captures', captureArtifactSchema.parse({ pageId: page.id,
        snapshot: { ...snapshot, desktopBase64: null, mobileBase64: null, desktopHtml: null } }))
    },
  },
  { kind: 'pagespeed', replay: 'read_only', timeoutMs: 45_000,
    validateResult: artifact => { speedArtifactSchema.parse(artifact.data) },
    async evaluate(context) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.max(1, context.deadline - Date.now()))
      try {
        const result = await fetchPageSpeedData(context.input.pageUrl, controller.signal,
          { fresh: true, strategies: [context.input.device ?? 'desktop'], singleAttempt: true })
        const failure = context.input.device === 'mobile' ? result.mobileFailure : result.desktopFailure
        if (failure?.retryable) {
          await executionTransaction(tx => tx.auditPipelineEvent.create({ data: { auditId: context.audit.id,
            executionId: context.task.id, traceId: context.audit.id, attempt: context.task.workAttempts,
            stage: 'checking', event: 'provider_attempt_observed', status: 'partial',
            detail: { version: 1, device: context.input.device ?? 'desktop', failure } } }))
          throw new TaskFailure(failure.code, true, failure.retryAfterMs ?? (failure.code === 'PROVIDER_QUOTA' ? 60_000 : undefined))
        }
        // Keep only normalized facts, not the provider's multi-megabyte trace.
        if (result.desktop) result.desktop = { ...result.desktop, raw: {} }
        if (result.mobile) result.mobile = { ...result.mobile, raw: {} }
        // A provider refusal is not a passing measurement. Preserve the returned typed errors.
        await executionTransaction(async tx => {
          if (context.input.primary) {
            const audit = await tx.audit.findUniqueOrThrow({ where: { id: context.audit.id }, select: { performanceData: true } })
            const prior = audit.performanceData && typeof audit.performanceData === 'object' && !Array.isArray(audit.performanceData) ? audit.performanceData : {}
            const device = context.input.device ?? 'desktop'
            const measurement = device === 'desktop' ? result.desktop : result.mobile
            await tx.audit.update({ where: { id: context.audit.id }, data: {
              performanceData: { ...prior, [device]: measurement ? toStoredPageSpeedResult(measurement) : null,
                [device + 'Error']: (device === 'desktop' ? result.desktopError : result.mobileError) ?? null } as never,
            } })
          }
        })
        return serializeArtifact('pagespeed', speedArtifactSchema.parse(result))
      } finally { clearTimeout(timer) }
    },
  },
]
