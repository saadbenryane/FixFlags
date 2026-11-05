import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { parseMetadataFromHtml } from '../../metadata'
import { CHECK_REGISTRY } from '../../check-registry'
import { hasRecordedRecoveryEvidence } from '../../recovery-evidence'
import { initialTaskPlan } from '../graph'
import { loadTaskGraph, persistTaskPlan } from '../engine'
import { lifecycleHandlers } from '../lifecycle'
import { serializeArtifact } from '../contracts'
import type { TaskContext } from '../registry'
import { executionSpecSchema } from '@/lib/sites/domain/execution-spec'

vi.mock('node:dns/promises', () => ({ resolve4: async () => ['93.184.216.34'], resolve6: async () => [] }))
const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('bounded deeper discovery through saved scope and real public GET collection', () => {
  const root = 'https://example.com/', peer = root + 'pricing'
  const auditIds: string[] = [], requests: string[] = []
  let repaired = false, blocked = false
  const primaryHtml = '<main><a href="/pricing">Pricing</a>' + Array.from({ length: 119 }, (_, index) =>
    `<a href="/item-${index}">Item ${index}</a>`).join('') + '</main>'
  const peerHtml = '<main><a href="/deeper-failure">Useful details</a></main>'
  const server = createServer((request, response) => {
    requests.push(request.url!)
    response.setHeader('content-type', 'text/html')
    if (request.url === '/deeper-failure' && !repaired) { response.writeHead(404); response.end('<h1>Page not found</h1>'); return }
    if (request.url === '/item-18' && blocked) { response.writeHead(403); response.end('Restricted'); return }
    response.end(request.url === '/pricing' ? peerHtml : '<main><h1>Useful details</h1></main>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const fetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== new URL(root).origin) throw new Error('External requests are unavailable in this fixture')
      return fetch(transport + url.pathname + url.search, options)
    })
  })
  afterAll(async () => {
    vi.unstubAllGlobals()
    await prisma.audit.deleteMany({ where: { id: { in: auditIds } } })
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.$disconnect()
  })

  async function analyze(dependency: 'current' | 'legacy' | 'foreign' | 'unreadable' = 'current') {
    requests.length = 0
    const intent = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: root,
      reviewDepth: 3, environment: 'production', checks: { 'broken-internal-links': CHECK_REGISTRY['broken-internal-links'].version },
      outcomes: [], verificationTarget: null }
    const spec = executionSpecSchema.parse(intent)
    const audit = await prisma.audit.create({ data: { url: root, startedAt: new Date(), reviewDepth: 3, executionSpec: intent } })
    auditIds.push(audit.id)
    await persistTaskPlan(audit.id, initialTaskPlan(spec))
    async function browser(pageUrl: string, html: string) {
      const task = (await loadTaskGraph(audit.id)).find(task => task.workKind === 'browser' && task.pageUrl === pageUrl)!
      await prisma.auditVerifierExecution.update({ where: { id: task.id }, data: { workState: 'COMPLETED', status: 'COMPLETED',
        workResult: serializeArtifact('browser', { pageId: 'controlled-browser-' + task.id, metadata: parseMetadataFromHtml(html, pageUrl),
          snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: html, desktopBase64: null, mobileBase64: null,
            consoleErrors: [], captureFailures: [], captureStatus: { desktop: 'ok', mobile: 'pending' },
            renderedScope: { pageUrl, finalUrl: pageUrl, profile: 'desktop', access: 'public' } } }) } })
    }
    await browser(root, primaryHtml)
    const handler = lifecycleHandlers.find(handler => handler.kind === 'discovery')!
    const firstTask = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: audit.id, targetKey: 'task:discovery' } })
    const context = (task: typeof firstTask, dependencies: TaskContext['dependencies']): TaskContext => ({
      audit, task, input: task.workInput as TaskContext['input'], deadline: Date.now() + 45_000, dependencies,
    })
    // Browser inputs are controlled saved captures. The handler, graph expansion,
    // bounded HTTP collector and real response bodies execute normally.
    const first = await handler.evaluate(context(firstTask, new Map()))
    handler.validateResult(first)
    const saved = await prisma.auditVerifierExecution.update({ where: { id: firstTask.id }, data: {
      status: 'COMPLETED', workState: 'COMPLETED', workResult: first,
    } })
    expect(first.data.openCheckCount).toBe(120)
    expect(requests).toHaveLength(120)
    await browser(peer, peerHtml)
    const secondTask = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: audit.id, targetKey: 'task:discovery:second' } })
    const prior = structuredClone(saved)
    if (dependency === 'foreign') prior.auditId = 'another-analysis'
    if (dependency === 'legacy' && prior.workResult && typeof prior.workResult === 'object' && !Array.isArray(prior.workResult))
      prior.workResult = { ...first, data: Object.fromEntries(Object.entries(first.data).filter(([key]) => key !== 'httpEvidence')) }
    if (dependency === 'unreadable') prior.workResult = { ...first, version: 99 }
    const second = await handler.evaluate(context(secondTask, new Map([['discovery', prior]])))
    handler.validateResult(second)
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: saved.id } })).toEqual(saved)
    return { audit, spec, first, second }
  }

  it('finds a deeper broken link beside a full first-pass inventory, independently recovers and recognizes recurrence', async () => {
    const before = await analyze()
    expect(requests.filter(path => path === '/deeper-failure')).toHaveLength(1)
    expect(requests).toHaveLength(121)
    expect(before.second.data.openCheckCount).toBe(1)
    expect(before.second.data.reusedHttpEvidence).toMatchObject({ taskId: expect.any(String), evaluatedAt: expect.any(String) })
    const flag = (before.second.data.flags as Array<{ checkId: string; pageUrl: string }>).find(flag => flag.checkId === 'broken-internal-links' && flag.pageUrl === peer)!
    expect(flag).toBeDefined()
    repaired = true
    const after = await analyze()
    expect(requests).toHaveLength(121)
    expect(after.second.data.flags).toEqual([])
    const executions = (after.second.data.receipts as unknown[]).map(detail => ({ targetKey: 'module:seo', status: 'COMPLETED', detail }))
    expect(hasRecordedRecoveryEvidence({ auditId: after.audit.id, executionSpec: after.spec, flag, executions })).toBe(true)
    repaired = false
    const again = await analyze()
    expect(again.second.data.flags).toMatchObject([{ checkId: 'broken-internal-links', pageUrl: peer }])
    expect(hasRecordedRecoveryEvidence({ auditId: again.audit.id, executionSpec: again.spec, flag,
      executions: (again.second.data.receipts as unknown[]).map(detail => ({ targetKey: 'module:seo', status: 'COMPLETED', detail })) })).toBe(false)
  })

  it('retries an inconclusive first-pass response without hiding an independent deeper failure', async () => {
    blocked = true
    try {
      const result = await analyze()
      expect(requests.filter(path => path === '/item-18')).toHaveLength(2)
      expect(requests.filter(path => path === '/deeper-failure')).toHaveLength(1)
      expect(requests).toHaveLength(122)
      expect(result.second.data.openCheckCount).toBe(2)
      expect(result.second.data.flags).toMatchObject([{ checkId: 'broken-internal-links', pageUrl: peer }])
    } finally { blocked = false }
  })

  it.each(['legacy', 'foreign', 'unreadable'] as const)('keeps unavailable deeper destinations unknown with a %s prior checkpoint', async dependency => {
    const result = await analyze(dependency)
    expect(result.second.data.reusedHttpEvidence).toBeUndefined()
    expect(result.second.data.openCheckCount).toBe(120)
    expect(requests).toHaveLength(240)
    expect(result.second.data.flags).toEqual([])
    const receipts = result.second.data.receipts as Array<{ pageUrl: string; complete: boolean; assertions: Array<{ complete: boolean }> }>
    expect(receipts.find(receipt => receipt.pageUrl === peer)).toMatchObject({ complete: false, assertions: [{ complete: false }] })
  })
})
