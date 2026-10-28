import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectionHandlers } from '../collectors'
import { evaluatorHandlers } from '../evaluators'
import { browserArtifactSchema, httpArtifactSchema } from '../snapshots'
import { readArtifact, TaskFailure } from '../contracts'
import { checkArtifactSchema } from '../results'
import type { TaskContext } from '../registry'
import { healthyMeta } from '../../__tests__/check-fixtures'

const boundary = vi.hoisted(() => ({ parse: vi.fn(), capture: vi.fn(), document: vi.fn(), access: vi.fn(), consumers: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: {get auditExecutionTask() { return this.auditVerifierExecution }, get auditVerificationReceipt() { return this.auditVerifierExecution },  auditVerifierExecution: { findMany: boundary.consumers } } }))
vi.mock('../cpu', async importOriginal => ({ ...await importOriginal<typeof import('../cpu')>(), parseMetadataIsolated: boundary.parse }))
vi.mock('../../screenshot', () => ({ captureScreenshots: boundary.capture, getAuditBrowser: vi.fn() }))
vi.mock('../../search/collect', async importOriginal => ({ ...await importOriginal<typeof import('../../search/collect')>(), collectDocument: boundary.document }))
vi.mock('../../scan-access-store', () => ({ resolveAuditScanAccess: boundary.access }))
vi.mock('../../execution-ownership', () => ({ executionTransaction: async (work: (tx: unknown) => unknown) => work({
  auditPage: { upsert: async () => ({ id: 'page' }), update: async () => ({}) }, audit: { update: async () => ({}) },
}) }))

const pageUrl = 'https://example.com/'
const scope = { pageUrl, finalUrl: pageUrl, profile: 'desktop', access: 'public' }
const context = (): TaskContext => ({ audit: { id: 'audit', executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
  environment: 'production', scope: 'SITE', checks: { 'buttons-no-text': 1, 'page-http-error': 1 }, outcomes: [], verificationTarget: null } },
  task: { id: 'task', workGeneration: 1 }, input: { pageUrl, position: 0, primary: true, role: 'primary' },
  deadline: Date.now() + 10_000, dependencies: new Map() } as unknown as TaskContext)
beforeEach(() => {
  boundary.consumers.mockReset().mockResolvedValue([])
  boundary.parse.mockReset(); boundary.capture.mockReset(); boundary.document.mockReset()
  boundary.access.mockReset().mockResolvedValue(null)
  boundary.document.mockResolvedValue({ url: pageUrl, finalUrl: pageUrl, status: 200, headers: { 'content-type': 'text/html' },
    body: '<main><h1>Useful service</h1></main>', complete: true, reason: null, redirects: [], collectedAt: new Date().toISOString() })
  boundary.capture.mockResolvedValue({ desktopUrl: null, mobileUrl: null, desktopHtml: '<main><h1>Useful service</h1><button></button></main>',
    desktopFinalUrl: pageUrl, desktopBase64: null, mobileBase64: null, renderedScope: scope,
    technologyResources: [], technologyRuntimeMarkers: [], responseHeaders: {},
    consoleErrors: [{ type: 'error', text: 'Observed script failure' }], captureFailures: [], captureStatus: { desktop: 'ok', mobile: 'pending' },
    accessibilityEvidence: { scope, engine: 'fixture-engine', rules: [{ id: 'button-name', state: 'failed', nodes: 1 }] },
    axeViolations: [{ id: 'button-name', impact: 'serious', description: 'Name required', help: 'Name required', helpUrl: 'https://example.com/rule',
      nodes: [{ target: ['button'], html: '<button></button>', failureSummary: 'Add an accessible name' }] }],
  })
})

describe('browser technology checkpoint publication', () => {
  it('uses the saved consumer cohort rather than all registered checks in the execution specification', async () => {
    boundary.parse.mockResolvedValue(healthyMeta())
    const ctx = context()
    ctx.task.targetKey = 'task:p0:browser'
    boundary.consumers.mockResolvedValue([{ workKind: 'check', workInput: { ...ctx.input, module: 'metadata' } }])
    await collectionHandlers.find(handler => handler.kind === 'browser')!.evaluate(ctx)
    expect(boundary.capture).toHaveBeenCalledWith(pageUrl, 'audit', expect.any(String), expect.objectContaining({
      collectMobile: false, collectAccessibility: false,
    }))
  })
  it('detects from private HTML before redaction and commits the profile with the task transaction', async () => {
    boundary.parse.mockResolvedValue(healthyMeta())
    boundary.access.mockResolvedValue({ httpBasic: { username: 'PRIVATE_USER', password: 'PRIVATE_PASSWORD' } })
    const captured = await boundary.capture()
    boundary.capture.mockResolvedValue({ ...captured, desktopHtml: '<main data-reactroot>PRIVATE_PAGE</main>',
      technologyResources: [], technologyRuntimeMarkers: [], responseHeaders: {},
      renderedScope: { ...scope, access: 'credentialed:fixture-key' } })
    const handler = collectionHandlers.find(handler => handler.kind === 'browser')!, ctx = context()
    const artifact = await handler.evaluate(ctx)
    expect(artifact.data).toMatchObject({ snapshot: { desktopHtml: null }, technologies: { status: 'COMPLETE',
      scope: { access: 'credentialed:fixture-key' }, detections: [expect.objectContaining({ name: 'React' })] } })
    expect(JSON.stringify(artifact)).not.toMatch(/PRIVATE_(PAGE|USER|PASSWORD)/)
    const tx = { auditTechnologyObservation: { deleteMany: vi.fn(), create: vi.fn() },
      technology: { upsert: vi.fn(async () => ({ id: 'react' })) }, audit: { update: vi.fn() } }
    await handler.commit!(ctx, artifact, tx as never)
    expect(tx.auditTechnologyObservation.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      auditId: 'audit', technologyId: 'react', evidence: [{ type: 'html', label: 'React DOM marker' }],
    }) })
    expect(tx.audit.update).toHaveBeenCalledWith({ where: { id: 'audit' }, data: expect.objectContaining({
      technologyDetectionStatus: 'COMPLETE', technologyObservationScope: { ...scope, access: 'credentialed:fixture-key' },
    }) })
    tx.audit.update.mockClear()
    await handler.commit!({ ...ctx, input: { ...ctx.input, primary: false } }, artifact, tx as never)
    expect(tx.audit.update).not.toHaveBeenCalled()
  })

  it('does not manufacture a profile when replaying a historical checkpoint', async () => {
    boundary.parse.mockResolvedValue(healthyMeta())
    const handler = collectionHandlers.find(handler => handler.kind === 'browser')!, ctx = context()
    const artifact = await handler.evaluate(ctx)
    const data = browserArtifactSchema.parse(artifact.data)
    delete data.technologies
    await handler.commit!(ctx, { ...artifact, data } as never, {} as never)
  })
})

describe('metadata parsing failure boundary', () => {
  it.each(['http', 'browser'] as const)('retries a transient parser crash without repeating the %s observation', async kind => {
    boundary.parse.mockRejectedValueOnce(new TaskFailure('PARSER_CRASH', true, undefined, true)).mockResolvedValueOnce(healthyMeta())
    const handler = collectionHandlers.find(handler => handler.kind === kind)!
    const artifact = await handler.evaluate(context())
    handler.validateResult(artifact)
    expect(artifact.data).toMatchObject({ metadata: { title: healthyMeta().title } })
    expect(boundary.parse).toHaveBeenCalledTimes(2)
    expect(kind === 'http' ? boundary.document : boundary.capture).toHaveBeenCalledTimes(1)
  })

  it.each(['http', 'browser'] as const)('retains independent %s evidence after repeated parser crashes', async kind => {
    boundary.parse.mockRejectedValue(new TaskFailure('PARSER_CRASH', true, undefined, true))
    const ctx = context(), handler = collectionHandlers.find(handler => handler.kind === kind)!
    const artifact = await handler.evaluate(ctx)
    handler.validateResult(artifact)
    expect(artifact.data).toMatchObject({ metadata: null, metadataFailure: { code: 'PARSER_CRASH', attempts: 2 } })
    expect(kind === 'http' ? boundary.document : boundary.capture).toHaveBeenCalledTimes(1)
    const checkModule = kind === 'http' ? 'page-response' : 'accessibility'
    if (kind === 'http') expect(httpArtifactSchema.parse(artifact.data).document).toMatchObject({ status: 200, complete: true })
    else expect(browserArtifactSchema.parse(artifact.data)).toMatchObject({ technologies: { status: 'COMPLETE' },
      snapshot: { consoleErrors: [{ text: 'Observed script failure' }],
        accessibilityEvidence: { rules: [{ id: 'button-name', state: 'failed' }] } } })
    ctx.input.module = checkModule
    ctx.dependencies.set(kind, { workKind: kind, workState: 'COMPLETED', workResult: artifact } as never)
    const checked = checkArtifactSchema.parse(readArtifact(await evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate(ctx), 'check').data)
    if (kind === 'http') expect(checked).toMatchObject({ flags: [], receipt: { complete: true, passed: true } })
    else expect(checked.flags.map(flag => flag.checkId)).toContain('buttons-no-text')
  })

  it('preserves a typed limitation without retaining an unexpected parser error message', async () => {
    boundary.parse.mockRejectedValue(new Error('PRIVATE_PARSER_INPUT'))
    const artifact = await collectionHandlers.find(handler => handler.kind === 'http')!.evaluate(context())
    expect(artifact.data).toMatchObject({ metadata: null, metadataFailure: { code: 'METADATA_PARSE_FAILED', attempts: 1 } })
    expect(JSON.stringify(artifact)).not.toContain('PRIVATE_PARSER_INPUT')
  })

  it.each(['HTML_BODY_LIMIT', 'PARSER_DEADLINE'])('keeps collected HTTP evidence under %s without retrying unavailable work', async code => {
    const ctx = context()
    if (code === 'PARSER_DEADLINE') ctx.deadline = Date.now() - 1
    boundary.parse.mockRejectedValue(new TaskFailure(code, code === 'PARSER_DEADLINE', undefined, code === 'PARSER_DEADLINE'))
    const artifact = await collectionHandlers.find(handler => handler.kind === 'http')!.evaluate(ctx)
    expect(httpArtifactSchema.parse(artifact.data)).toMatchObject({ metadata: null, metadataFailure: { code, attempts: 1 }, document: { status: 200, complete: true } })
    expect(boundary.parse).toHaveBeenCalledTimes(1)
    expect(boundary.document).toHaveBeenCalledTimes(1)
  })
})
