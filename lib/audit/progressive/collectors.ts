import { RENDERED_HTML_LIMIT } from '../browser/rendered-html'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { executionTransaction } from '../execution-ownership'
import { captureScreenshots } from '../screenshot'
import { mergeRuntimeHeadMetadata, trimMetadataForStorage } from '../metadata'
import { collectDocument, collectSiteResources, missingDocument } from '../search/collect'
import { resolveAuditScanAccess } from '../scan-access-store'
import { fetchPageSpeedData, toStoredPageSpeedResult, PAGESPEED_TASK_TIMEOUT_MS } from '../pagespeed'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '../viewports'
import { httpArtifactSchema, browserArtifactSchema, captureArtifactSchema, speedArtifactSchema, resourceArtifactSchema } from './snapshots'
import type { MetadataFailure } from './snapshots'
import { MAX_TASKS_PER_AUDIT, serializeArtifact, readArtifact, TaskFailure } from './contracts'
import type { TaskHandler } from './registry'
import { parseMetadataIsolated } from './cpu'
import { getAuditBrowser } from '../screenshot'
import { createAuditPage, PAGE_TIMEOUT_MS } from '../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE, MOBILE_CAPTURE_PROFILE } from '../browser/capture-profile'
import { collectKeyboardEvidence, keyboardEvidenceSchema } from '../browser/keyboard-probe'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { motionObservationSchema, motionRequested } from '../checks/motion-evidence'
import { collectReducedMotionWindow } from '../browser/motion-observation'
import { captureAccessKey, captureProfileKey } from '../browser/observation-scope'
import type { MetadataMode } from '../metadata'
import { observeCapturedTechnologies } from '../technology-capture'
import { persistTechnologyObservations } from '../technology-profile'
import { capturedPagePreview } from '../checks/page-preview'
import { capturedHeadMetadata } from '../checks/head-metadata'
import { browserCollectionRequirements } from './browser-requirements'
import { PAGE_COLLECTION_UNAVAILABLE } from '@/lib/marketing/copy/page-evidence'

/** Parsing enriches an already collected document. A bounded local retry can
 * replace a crashed parser without repeating its HTTP or browser observation. */
async function collectMetadata(html: string, url: string, deadline: number, mode: MetadataMode = 'crawler') {
  for (let attempts = 1; ; attempts++) {
    try { return { metadata: await parseMetadataIsolated(html, url, deadline, mode) } }
    catch (error) {
      if (attempts < 2 && error instanceof TaskFailure && error.crash && error.retryable && Date.now() < deadline) continue
      const metadataFailure: MetadataFailure = { code: error instanceof TaskFailure ? error.code : 'METADATA_PARSE_FAILED', attempts }
      return { metadata: null, metadataFailure }
    }
  }
}

/** Browser and capture tasks can insert the same page together. The committed row wins. */
async function openAuditPage(auditId: string, pageUrl: string, position: number, role: string) {
  const where = { auditId_normalizedUrl: { auditId, normalizedUrl: pageUrl } }
  const create = { auditId, url: pageUrl, normalizedUrl: pageUrl, position, role, status: 'CAPTURING' as const }
  try {
    return await executionTransaction(tx => tx.auditPage.upsert({ where, create, update: {} }))
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    const existing = await prisma.auditPage.findUnique({ where })
    if (!existing) throw error
    return existing
  }
}

function requestedConsoleWindow(spec: ReturnType<typeof readExecutionSpec>, pageUrl: string) {
  return spec?.consoleObservationScopes?.find(scope => new URL(scope.pageUrl).href === pageUrl)?.minimumMs ?? spec?.consoleObservationMs ?? 0
}

export const collectionHandlers: TaskHandler[] = [
  { kind: 'motion', replay: 'read_only', timeoutMs: 45_000,
    validateResult: artifact => { motionObservationSchema.parse(artifact.data) },
    async evaluate(context) {
      const browser = [...context.dependencies.values()].find(task => task.workKind === 'browser' && task.workState === 'COMPLETED')
      const captured = browser?.workResult ? browserArtifactSchema.parse(readArtifact(browser.workResult, 'browser').data) : null
      const before = captured?.snapshot.motionWindow
      if (!before) {
        const pageUrl = context.input.pageUrl
        const unavailable = { version: 1 as const, pageUrl, reduced: false, targets: [], complete: false, windowMs: 0, observedMs: 0, restricted: false, contentVisible: false }
        return serializeArtifact('motion', motionObservationSchema.parse({ version: 1,
          scope: { pageUrl, finalUrl: pageUrl, profile: captureProfileKey(MOBILE_CAPTURE_PROFILE), access: captureAccessKey(null, pageUrl) },
          before: unavailable, after: unavailable }))
      }
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
      // A document that never arrives is still the observation. Dependent checks
      // record that gap. Retrying the task would hide it until recovery ends.
      const document = await collectDocument(context.input.pageUrl, context.deadline)
      const metadata = document.status !== null && document.status >= 200 && document.status < 300 && document.complete && document.body && /(?:text\/html|application\/xhtml\+xml)/i.test(document.headers['content-type'] ?? '')
        ? await collectMetadata(document.body, document.finalUrl, context.deadline) : { metadata: null }
      return serializeArtifact('http', httpArtifactSchema.parse({ document, ...metadata }))
    },
  },
  { kind: 'browser', replay: 'read_only', timeoutMs: (audit, input) => Math.max(90_000,
    2 * (PAGE_TIMEOUT_MS + requestedConsoleWindow(readExecutionSpec(audit.executionSpec), input.pageUrl) + 5_000)),
    validateResult: artifact => { browserArtifactSchema.parse(artifact.data) },
    async evaluate(context) {
      const pageUrl = new URL(context.input.pageUrl).toString()
      const page = await openAuditPage(context.audit.id, pageUrl, context.input.position, context.input.role)
      const access = await resolveAuditScanAccess(context.audit.id)
      const spec = readExecutionSpec(context.audit.executionSpec)
      const consoleObservationMs = requestedConsoleWindow(spec, pageUrl)
      const consumers = context.task.targetKey?.startsWith('task:')
        ? await prisma.auditExecutionTask.findMany({ where: { auditId: context.audit.id,
          workDependencies: { has: context.task.targetKey.slice(5) } },
          select: { workKind: true, workInput: true }, take: MAX_TASKS_PER_AUDIT + 1 }) : []
      if (consumers.length > MAX_TASKS_PER_AUDIT) throw new TaskFailure('TASK_GRAPH_LIMIT', false)
      const requirements = browserCollectionRequirements(consumers, spec?.checks)
      // DOM and semantics have no private-storage dependency. Media has its own
      // checkpoint and recovery window, so an upload outage cannot erase this input.
      const captured = await captureScreenshots(pageUrl, context.audit.id,
        `p${context.input.position}-g${context.task.workGeneration}`, { runFlow: false, scanAccess: access, deadline: context.deadline,
          collectOriginalDocument: false, captureMedia: false, consoleObservationMs, captureMotion: motionRequested(spec), deferMotionComparison: true,
          ...requirements })
      const htmlWithinBudget = captured.desktopHtml && Buffer.byteLength(captured.desktopHtml) <= RENDERED_HTML_LIMIT
      const parsed = htmlWithinBudget ? await collectMetadata(captured.desktopHtml!, captured.desktopFinalUrl ?? pageUrl, context.deadline, 'rendered') : { metadata: null }
      const head = capturedHeadMetadata(captured)
      const metadata = parsed.metadata ? mergeRuntimeHeadMetadata(parsed.metadata, head?.metadata, captured.renderedCopy) : null
      if (!metadata && !captured.desktopHtml && !captured.desktopHtmlTruncated && !captured.captureFailures?.some(failure => ['HTTP_ERROR', 'HTTP_FORBIDDEN', 'HTTP_RATE_LIMIT', 'NON_HTML_RESPONSE'].includes(failure.code)))
        throw new TaskFailure('BROWSER_COLLECTION_INTERRUPTED', true, undefined, true)
      await executionTransaction(async tx => {
        await tx.auditPage.update({ where: { id: page.id }, data: {
          status: metadata ? 'CHECKING' : 'FAILED', title: metadata?.title,
          ...(metadata ? { htmlMetadata: trimMetadataForStorage(metadata) as never } : {}),
          consoleErrors: captured.consoleErrors as Prisma.InputJsonValue,
          ...(!metadata ? { failureCode: 'BROWSER_SCOPE_UNAVAILABLE', failureMessage: PAGE_COLLECTION_UNAVAILABLE } : {}),
        } })
        if (context.input.primary && metadata) await tx.audit.update({ where: { id: context.audit.id }, data: {
          htmlMetadata: trimMetadataForStorage(metadata) as never, consoleErrors: captured.consoleErrors as Prisma.InputJsonValue,
        } })
      })
      // Secret-bearing original/rendered HTML never enters the durable public collector snapshot.
      const snapshot = { ...captured }
      delete snapshot.flowResult
      if (metadata) delete snapshot.renderedCopy // Parsed metadata owns this observation when available.
      return serializeArtifact('browser', browserArtifactSchema.parse({ pageId: page.id, ...parsed, metadata,
        preview: capturedPagePreview(captured),
        ...(context.input.primary ? { technologies: observeCapturedTechnologies(captured) } : {}),
        snapshot: { ...snapshot, desktopBase64: null, mobileBase64: null,
          ...(!htmlWithinBudget ? { desktopHtml: null } : {}),
          ...(access ? { desktopHtml: null, originalDocument: undefined } : {}) } }))
    },
    async commit(context, artifact, tx) {
      const { technologies } = browserArtifactSchema.parse(artifact.data)
      if (context.input.primary && technologies) await persistTechnologyObservations(context.audit.id,
        technologies.detections, technologies.status, technologies.detectorVersion, undefined, { tx, scope: technologies.scope })
    },
  },
  { kind: 'captures', replay: 'read_only', timeoutMs: 90_000,
    validateResult: artifact => { captureArtifactSchema.parse(artifact.data) },
    async evaluate(context) {
      const pageUrl = new URL(context.input.pageUrl).toString()
      const page = await openAuditPage(context.audit.id, pageUrl, context.input.position, context.input.role)
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
  { kind: 'pagespeed', replay: 'read_only', timeoutMs: PAGESPEED_TASK_TIMEOUT_MS,
    validateResult: artifact => { speedArtifactSchema.parse(artifact.data) },
    async evaluate(context) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.max(1, context.deadline - Date.now()))
      const signal = context.signal ? AbortSignal.any([controller.signal, context.signal]) : controller.signal
      try {
        const result = await fetchPageSpeedData(context.input.pageUrl, signal,
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
