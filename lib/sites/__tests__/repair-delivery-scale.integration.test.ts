import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteRecord } from '../ensure-site'
import { loadSiteRepairBriefPage } from '../flags'
import { deliverSiteRepairBrief } from '../repair-delivery'
import { repairBriefSchema } from '../repair-brief-contract'
import { loadSiteFlagCopyTask } from '../application/flag-copy-task'
import { prepareSiteRepairFile } from '../application/repair-file'
import { repairFileSchema } from '../repair-file-contract'
import { loadRepairSelection } from '../application/repair-selection'

const profile = vi.hoisted(() => ({ active: false, calls: 0, serializedResultBytes: 0 }))
vi.mock('@/lib/db', async original => {
  const { prisma } = await original<typeof import('@/lib/db')>()
  return { prisma: prisma.$extends({ query: { async $allOperations({ args, query }) {
    const result = await query(args)
    if (profile.active) {
      profile.calls++
      profile.serializedResultBytes += Buffer.byteLength(JSON.stringify(result, (_key, value) => typeof value === 'bigint' ? String(value) : value))
    }
    return result
  } } }) }
})

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('complete persisted repair traversal', () => {
  let owner: string, siteId: string, sourceId: string
  const scope = randomUUID()
  beforeEach(async () => {
    profile.calls = 0; profile.serializedResultBytes = 0
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    owner = (await prisma.user.create({ data: { email: scope + '@repair-scale.example' } })).id
    siteId = (await prisma.project.create({ data: { userId: owner, canonicalHost: 'repair-scale.example',
      url: 'https://repair-scale.example/', name: 'Controlled scale fixture', watchInterval: null } })).id
    const audit = await prisma.audit.create({ data: { userId: owner, projectId: siteId, url: 'https://repair-scale.example/',
      status: 'COMPLETED', completedAt: new Date(), includeAi: false } })
    sourceId = (await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', checkId: 'buttons-no-text',
      rubric: 'EXPERIENCE', severity: 'IMPORTANT', position: 0, confidence: 1,
      pageUrl: audit.url, problem: 'Controls have no accessible name', evidence: 'Recorded unnamed controls',
      whyItMatters: 'The control purpose is unavailable', fix: 'Name each recorded control',
      verificationRule: 'The original controls have accessible names',
      supportingObservations: { version: 1, items: Array.from({ length: 5000 }, (_, index) => ({
        source: 'DETERMINISTIC', checkId: 'buttons-no-text', checkVersion: 1, pageUrl: audit.url,
        evidence: 'Recorded 🧭 control ' + index, verificationRule: 'Has an accessible name',
        evidenceTargets: [{ kind: 'element', source: 'measured', device: 'mobile', label: 'Control', selector: '#control-' + index,
          context: 'private-comparison-fixture' }],
        provenance: { auditId: audit.id, taskId: 'scale-fixture', collectedAt: '2026-11-05T10:00:00.000Z' },
      })) },
    } })).id
  })
  afterEach(async () => {
    profile.active = false
    if (owner) await prisma.user.deleteMany({ where: { id: owner } })
  }, 120_000)

  it('measures every application/database continuation and reconstructs the full supported group', async () => {
    const site = (await loadSiteRecord(siteId))!
    let offset = 0, contextHash: string | undefined
    const received = [], latencies = []
    let outputBytes = 0, pages = 0, peakRss = process.memoryUsage().rss
    const started = performance.now()
    profile.active = true
    try {
      for (;;) {
        const pageStarted = performance.now()
        const brief = (await loadSiteRepairBriefPage(site, sourceId, 'https://fixflags.test', offset, contextHash))!
        contextHash ??= brief.contextHash
        const delivered = deliverSiteRepairBrief(brief)
        expect(delivered.schemaVersion).toBe('fixflags.repair-brief.v1')
        const json = JSON.stringify(delivered)
        const parsed = repairBriefSchema.parse(JSON.parse(json))
        outputBytes += Buffer.byteLength(json)
        received.push(...parsed.flag.supportingObservations!)
        expect(json).not.toContain('private-comparison-fixture')
        pages++
        latencies.push(performance.now() - pageStarted)
        peakRss = Math.max(peakRss, process.memoryUsage().rss)
        if (parsed.observationPage.nextOffset === null) break
        offset = parsed.observationPage.nextOffset
      }
    } finally { profile.active = false }
    expect(received).toHaveLength(5000)
    expect(pages).toBe(200)
    expect(new Set(received.map(item => item.references[0].selector)).size).toBe(5000)
    // Includes the one cold index hydration. Subsequent windows must not
    // transfer the complete source once per requested page.
    expect(profile.serializedResultBytes).toBeLessThan(outputBytes * 4)
    expect(profile.calls).toBeLessThanOrEqual(pages * 6 + 10)
    const traversalElapsedMs = performance.now() - started
    const traversalQueries = { ormCalls: profile.calls, serializedOrmResultBytes: profile.serializedResultBytes }
    profile.calls = 0; profile.serializedResultBytes = 0
    const fileStarted = performance.now(), chunks = []
    profile.active = true
    try {
      const task = await loadSiteFlagCopyTask(site, sourceId)
      for await (const chunk of await prepareSiteRepairFile(site, { kind: 'flag', flagId: sourceId,
        expectedPromptHash: task.promptHash }, new AbortController().signal)) chunks.push(chunk)
    } finally { profile.active = false }
    const fileBytes = Buffer.concat(chunks)
    const file = repairFileSchema.parse(JSON.parse(fileBytes.toString('utf8')))
    expect(file.tasks[0].flag.supportingObservations).toEqual(received)
    expect(file.completion.taskCount).toBe(1)
    const ordered = latencies.toSorted((a, b) => a - b)
    const result = { schemaVersion: 1, scope: 'controlled-persisted-repair-traversal', pages, observations: received.length,
      elapsedMs: traversalElapsedMs, p50Ms: ordered[Math.floor(ordered.length * 0.5)],
      p95Ms: ordered[Math.floor(ordered.length * 0.95)], peakRss, outputBytes,
      ...traversalQueries,
      completeOwnerFile: { elapsedMs: performance.now() - fileStarted, outputBytes: fileBytes.length,
        ormCalls: profile.calls, serializedOrmResultBytes: profile.serializedResultBytes },
      limitations: ['Controlled local fixture. ORM serialization bytes are not PostgreSQL wire bytes.',
        'Includes measurement overhead. No browser, real provider or production traffic.',
        'A complete traversal is not evidence that its amplification meets an accepted budget.'] }
    const directory = path.resolve('test-results/runtime/repair-traversal-' + scope)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(path.join(directory, 'observations.json'), JSON.stringify(result, null, 2), { mode: 0o600 })
    console.log(JSON.stringify(result))
  }, 180_000)

  it('delivers all 100 selected tasks, including an oversized Unicode observation, while a peer Site remains readable', async () => {
    const audit = await prisma.audit.create({ data: { userId: owner, projectId: siteId, url: 'https://repair-scale.example/',
      status: 'COMPLETED', completedAt: new Date(), includeAi: false,
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://repair-scale.example/',
        environment: 'production', checks: { 'title-missing': 1 }, outcomes: [], verificationTarget: null } } })
    const ids = Array.from({ length: 100 }, () => randomUUID())
    const oversized = 'Original 🧭 \"quoted\" observation\n'.repeat(30_000)
    await prisma.flag.createMany({ data: ids.map((id, index) => ({ id, auditId: audit.id, source: 'DETERMINISTIC' as const,
      checkId: 'title-missing', rubric: 'REACH' as const, severity: 'IMPORTANT' as const, position: index, confidence: 1,
      pageUrl: audit.url + 'page-' + index, problem: 'A descriptive page title is missing', evidence: 'Recorded empty title ' + index,
      whyItMatters: 'The page lacks a recorded title', fix: 'Add a descriptive title for this recorded page.',
      verificationRule: 'This page declares a descriptive title.',
      supportingObservations: { version: 1, items: [{ source: 'DETERMINISTIC', checkId: 'title-missing', checkVersion: 1,
        pageUrl: audit.url + 'page-' + index, evidence: index === 0 ? oversized : 'Recorded empty title ' + index,
        verificationRule: 'A descriptive title is present', evidenceTargets: [],
        provenance: { auditId: audit.id, taskId: 'scale-selection-' + index, collectedAt: '2026-11-05T10:00:00.000Z' } }] },
    })) })
    const peer = await prisma.project.create({ data: { userId: owner, canonicalHost: 'peer-repair-scale.example',
      url: 'https://peer-repair-scale.example/', name: 'Independent fixture', watchInterval: null } })
    const site = (await loadSiteRecord(siteId))!
    profile.calls = 0; profile.serializedResultBytes = 0; profile.active = true
    const started = performance.now(), chunks: Buffer[] = [], peerLatencies: number[] = []
    let peakRss = process.memoryUsage().rss
    try {
      const selection = await loadRepairSelection(site, undefined, ids)
      expect(selection.flags).toHaveLength(100)
      const stream = await prepareSiteRepairFile(site, { kind: 'bundle', flagIds: ids, manifestHash: selection.manifestHash }, new AbortController().signal)
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk))
        peakRss = Math.max(peakRss, process.memoryUsage().rss)
        if (chunks.length % 30 === 0) {
          const before = performance.now()
          expect((await loadSiteRecord(peer.id))?.projectId).toBe(peer.id)
          peerLatencies.push(performance.now() - before)
        }
      }
    } finally { profile.active = false }
    const bytes = Buffer.concat(chunks), file = repairFileSchema.parse(JSON.parse(bytes.toString('utf8')))
    expect(file.completion.taskCount).toBe(100)
    expect(new Set(file.tasks.map(task => task.referenceFlagId))).toEqual(new Set(ids))
    expect(file.tasks.find(task => task.referenceFlagId === ids[0])!.flag.supportingObservations![0].evidence).toBe(oversized)
    expect(peerLatencies.length).toBeGreaterThan(0)
    expect(profile.serializedResultBytes).toBeLessThan(bytes.length * 20)
    const result = { schemaVersion: 1, scope: 'controlled-persisted-selected-repair-file', tasks: 100,
      elapsedMs: performance.now() - started, outputBytes: bytes.length, peakRss,
      ormCalls: profile.calls, serializedOrmResultBytes: profile.serializedResultBytes,
      peerReadP95Ms: peerLatencies.toSorted((a, b) => a - b)[Math.floor(peerLatencies.length * 0.95)],
      limitations: ['Synthetic local recorded evidence, no external editor acceptance.',
        'Peer reads demonstrate read availability, not independent worker progress.',
        'The test consumer buffers the delivered file for complete contract validation.'] }
    const directory = path.resolve('test-results/runtime/repair-selection-' + scope)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(path.join(directory, 'observations.json'), JSON.stringify(result, null, 2), { mode: 0o600 })
    console.log(JSON.stringify(result))
  }, 180_000)

  it('finishes independent Site work during a complete cold 5000-observation traversal', async () => {
    const { createServer } = await import('node:http')
    const { startWorker } = await import('@/lib/queue/worker')
    const { getAuditQueue, getAuditTaskQueue } = await import('@/lib/queue/client')
    const { TASK_QUEUES } = await import('@/lib/audit/progressive/queues')
    const { clearWorkerHeartbeat } = await import('@/lib/queue/worker-heartbeat')
    const { closeBrowser } = await import('@/lib/audit/screenshot')
    const pageSessions = await import('@/lib/audit/browser/page-session')
    const { applyJourneyRouteGuards } = await import('@/lib/audit/browser/journey-safety')
    const { requestSiteRun } = await import('../application/run-requests')
    const { getOwnedRun } = await import('../application/run-queries')
    const target = 'https://example.com/repair-contention-' + scope
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.end('<!doctype html><html lang="en"><head><title>Independent Site</title></head><body><main>Useful peer page</main></body></html>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port
    const nativeFetch = globalThis.fetch
    const transport = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.href !== target) throw new Error('External transport is unavailable in this fixture')
      return nativeFetch('http://127.0.0.1:' + port + url.pathname, init)
    })
    const createAuditPage = pageSessions.createAuditPage
    const browserTransport = vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => createAuditPage(browser, url, {
      ...options, configurePage: async page => {
        await page.route(/^https?:\/\/example\.com\//, async route => {
          if (route.request().url() !== target) return route.abort('blockedbyclient')
          await applyJourneyRouteGuards(route, async () => {
            const response = await fetch(target)
            await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
          })
        })
        await options.configurePage?.(page)
      },
    }))
    let worker: ReturnType<typeof startWorker> | undefined
    let peerCompletion: Promise<unknown> | undefined
    try {
      // Only the admitted peer operation runs. Background monitoring is paused
      // through fixture ownership, without changing scheduler or execution rules.
      await prisma.project.updateMany({ where: { userId: owner }, data: { watchPausedAt: new Date() } })
      const peer = await prisma.project.create({ data: { userId: owner, canonicalHost: 'example.com', url: target,
        name: 'Independent queued Site', watchPausedAt: new Date(), notificationLevel: 'OFF', accountChecksEnabled: false } })
      const outcome = await prisma.siteOutcome.create({ data: { projectId: peer.id, slug: 'peer-availability',
        name: 'The peer page responds', kind: 'AVAILABILITY', confirmedAt: new Date(),
        bindings: { create: { key: 'http', mechanism: 'HTTP_AVAILABILITY', required: true,
          config: { startUrl: target, expectedSelector: 'main' } } } } })
      worker = startWorker()
      await worker.waitUntilReady()
      const site = (await loadSiteRecord(siteId))!
      let pages = 0, observations = 0, offset = 0, contextHash: string | undefined
      let peerCompletedDuringPage = 0, peerProjectedAt: Date | undefined, runId: string | undefined
      const traversalStartedAt = new Date(), started = performance.now()
      profile.active = true
      for (;;) {
        const brief = (await loadSiteRepairBriefPage(site, sourceId, 'https://fixflags.test', offset, contextHash))!
        contextHash ??= brief.contextHash
        const delivered = repairBriefSchema.parse(deliverSiteRepairBrief(brief))
        pages++; observations += delivered.flag.supportingObservations!.length
        if (pages === 1) {
          const admitted = await requestSiteRun({ projectId: peer.id, userId: owner, outcomeIds: [outcome.id],
            source: 'WEB', idempotencyKey: 'repair-contention:' + scope })
          runId = admitted.runId
          peerCompletion = vi.waitFor(async () => {
            expect(await getOwnedRun(owner, admitted.runId)).toMatchObject({ status: 'COMPLETED', result: 'CLEAR' })
            const audit = await prisma.audit.findUniqueOrThrow({ where: { id: admitted.auditId! }, select: { improvementProjectedAt: true } })
            expect(audit.improvementProjectedAt).toBeInstanceOf(Date)
            peerProjectedAt = audit.improvementProjectedAt!
            peerCompletedDuringPage = pages
          }, { timeout: 15_000, interval: 50 })
          // Attach a rejection handler while the traversal continues. Await the
          // original promise below so any execution failure still fails the case.
          void peerCompletion.catch(() => undefined)
        }
        if (delivered.observationPage.nextOffset === null) break
        offset = delivered.observationPage.nextOffset
      }
      profile.active = false
      const traversalFinishedAt = new Date(), traversalElapsedMs = performance.now() - started
      await peerCompletion
      expect(pages).toBe(200); expect(observations).toBe(5000)
      expect(peerProjectedAt!.getTime()).toBeGreaterThanOrEqual(traversalStartedAt.getTime())
      expect(peerProjectedAt!.getTime()).toBeLessThan(traversalFinishedAt.getTime())
      expect(peerCompletedDuringPage).toBeGreaterThan(0)
      expect(peerCompletedDuringPage).toBeLessThan(200)
      const result = { schemaVersion: 1, scope: 'controlled-repair-traversal-with-independent-worker', pages, observations,
        traversalElapsedMs, traversalStartedAt, traversalFinishedAt, runId, peerProjectedAt, peerCompletedDuringPage,
        ormCalls: profile.calls, serializedOrmResultBytes: profile.serializedResultBytes,
        limitations: ['Controlled local HTTP transport, real application admission, PostgreSQL, Redis and worker.',
          'Aggregate ORM instrumentation includes concurrent worker reads. Not production throughput or general workload contention.'] }
      const directory = path.resolve('test-results/runtime/repair-contention-' + scope)
      await mkdir(directory, { recursive: true, mode: 0o700 })
      await writeFile(path.join(directory, 'observations.json'), JSON.stringify(result, null, 2), { mode: 0o600 })
      console.log(JSON.stringify(result))
    } finally {
      profile.active = false
      await peerCompletion?.catch(() => undefined)
      await worker?.close()
      await clearWorkerHeartbeat(); await closeBrowser()
      for (const queue of [getAuditQueue(), ...(Object.keys(TASK_QUEUES) as Array<keyof typeof TASK_QUEUES>).map(getAuditTaskQueue)]) {
        const client = await queue.client
        await queue.close(); client.disconnect()
      }
      transport.mockRestore()
      browserTransport.mockRestore()
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  }, 180_000)
})
