import { uptimeReadSite } from './__tests__/read-site'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { Queue } from 'bullmq'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createQueueRedis } from '@/lib/queue/redis'
import { probeUptime } from './probe'
import { executeUptimeProbe, retainUptimeHistory, scheduleUptimeProbes } from './service'
import { startUptimeWorker, uptimeJobId } from './queue'
import { loadUptimeHistory, loadUptimeSummary, loadUptimeStatus } from './queries'
import { uptimeAssessment } from './status'
import { answerProductQuestion } from '@/lib/workspace/chat'
import { UPTIME_INTERVAL_MS, UPTIME_RETENTION_MS } from './domain'

const dns = vi.hoisted(() => ({ missingLookups: 0 }))
vi.mock('node:dns/promises', async () => (await import('@/lib/audit/__tests__/dns-fixture')).dnsFixture({
  resolve4: async hostname => {
    if (hostname !== 'missing.example.com') return ['93.184.216.34']
    dns.missingLookups++
    throw Object.assign(new Error('Fixture DNS record does not exist'), { code: 'ENOTFOUND' })
  },
  resolve6: async () => [],
}))

const run = process.env.UPTIME_TEST_DATABASE_URL && process.env.RECOVERY_APP_QUEUE_REQUIRED === 'true' ? describe : describe.skip
run('redirect evidence through public HTTP and the installed uptime worker', () => {
  const target = 'http://example.com/'
  const missingOrigin = 'http://missing.example.com:8080'
  const missingDestination = missingOrigin + '/private?token=PRIVATE_VALUE'
  const redirectToken = 'PRIVATE_REDIRECT_TOKEN'
  let phase = 'loop', userId: string, projectId: string, monitorId: string
  let worker: ReturnType<typeof startUptimeWorker> | undefined, producer: Queue | undefined
  let connection: ReturnType<typeof createQueueRedis> | undefined
  const requestedPaths: string[] = []
  let instant = new Date(Math.floor(Date.now() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS + UPTIME_INTERVAL_MS - 10_000)
  const clock = { now: () => new Date(instant) }
  const server = createServer((request, response) => {
    const path = new URL(request.url!, target)
    requestedPaths.push(path.pathname)
    if (phase === 'socket-close') {
      if (path.pathname === '/before-headers') request.socket.end()
      else response.writeHead(302, { location: '/before-headers?token=PRIVATE_VALUE' }).end()
      return
    }
    if (phase === 'repaired' || path.pathname === '/appears-available') {
      response.setHeader('content-type', 'text/html')
      response.end('<html><body>Service available<!--' + 'x'.repeat(65_000) + '--></body></html>'); return
    }
    if (phase === 'partial') {
      response.writeHead(206, { 'content-type': 'text/html', 'content-range': 'bytes 0-16/100' })
      response.end('Partial document.'); return
    }
    if (phase === 'cookie-repaired') {
      if (path.pathname !== '/cookie-gate') {
        response.writeHead(302, { location: '/cookie-gate?token=' + redirectToken, 'set-cookie': 'visitor=allowed; Path=/; HttpOnly' }).end()
      } else if (request.headers.cookie === 'visitor=allowed' && path.searchParams.get('token') === redirectToken) {
        response.setHeader('content-type', 'text/html')
        response.end('<html><body>Service available to this visitor</body></html>')
      } else {
        response.writeHead(503).end()
      }
      return
    }
    if (phase === 'budget' || phase === 'dns') {
      const hop = Number(path.pathname.split('/').at(-1)) || 0
      const location = phase === 'dns' || hop === 5 ? missingDestination : '/budget/' + (hop + 1)
      response.writeHead(302, { location }).end(); return
    }
    if (phase === 'not-modified') { response.writeHead(304, { location: '/appears-available' }).end(); return }
    if (phase === 'proxy-authentication') {
      response.writeHead(407, { 'proxy-authenticate': 'Basic realm="Fixture proxy"' }).end(); return
    }
    if (phase === 'network-authentication') {
      response.writeHead(511, { 'content-type': 'text/html' }).end('<h1>Network sign-in required</h1>'); return
    }
    if (phase === 'sign-in') {
      if (path.pathname === '/account/login') {
        response.setHeader('content-type', 'text/html'); response.end('<html><head><title>Sign in to continue</title></head></html>')
      } else { response.writeHead(302, { location: '/account/login' }); response.end() }
      return
    }
    if (phase === 'challenge') {
      if (path.pathname === '/gate') response.writeHead(302, { 'cf-mitigated': 'challenge', location: '/appears-available' })
      else response.writeHead(302, { location: '/gate' })
      response.end()
      return
    }
    if (phase === 'cookie' && path.pathname === '/') response.setHeader('set-cookie', 'visitor=allowed; Path=/')
    response.writeHead(302, { location: phase === 'chain' ? '/chain/' + (Number(path.pathname.split('/').at(-1)) + 1 || 1)
      : path.pathname === '/again' ? '/' : '/again' })
    response.end()
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_uptime_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable uptime execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== new URL(target).origin) throw new Error('External transport unavailable in this fixture')
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    userId = 'redirect-uptime-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', auditsUsed: 3 } })
    const site = await prisma.project.create({ data: { userId, name: 'Redirect uptime fixture', canonicalHost: 'example.com', url: target,
      watchInterval: 'WEEKLY', watchNextRunAt: instant } })
    projectId = site.id
    connection = createQueueRedis(); producer = new Queue('uptime-probes', { connection })
    await producer.waitUntilReady()
    worker = startUptimeWorker(job => executeUptimeProbe(job, probeUptime, clock))
  })
  afterAll(async () => {
    await worker?.close(); await producer?.close(); await connection?.quit()
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.unstubAllGlobals()
  })
  async function observe(count: number, result: string, reason: string, statusCode: number | null = result === 'ONLINE' ? 200 : 302) {
    await scheduleUptimeProbes(clock, 1, projectId)
    const monitor = await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId } })
    monitorId = monitor.id
    const payload = { monitorId, version: monitor.version, scheduledAt: (monitor.pendingSlotAt ??
      new Date(Math.floor(instant.getTime() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS)).toISOString(), attempt: monitor.pendingSlotAt ? 2 as const : 1 as const }
    const queued = await producer!.getJob(uptimeJobId(payload))
    // Promote only the controlled fixture's due job; this is not wall-clock proof.
    if (queued && await queued.getState() === 'delayed') await queued.promote()
    await vi.waitFor(async () => {
      expect(await prisma.uptimeProbe.count({ where: { monitorId } })).toBe(count)
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).toMatchObject({ leaseToken: null })
    }, { timeout: 8000, interval: 25 })
    const probe = await prisma.uptimeProbe.findFirstOrThrow({ where: { monitorId }, orderBy: [{ observedAt: 'desc' }, { attempt: 'desc' }] })
    expect(probe).toMatchObject({ result, reason, statusCode, targetUrl: target })
    return probe
  }
  async function advance() {
    const due = (await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).nextProbeAt
    instant = new Date(Math.max(instant.getTime() + 1, due.getTime()))
  }
  async function answerAvailability(message = 'What needs attention?') {
    const status = (await loadUptimeStatus(uptimeReadSite({ id: projectId, userId }), clock.now()))!
    return answerProductQuestion({ message, flags: [], improvements: [], learnings: [],
      diff: { hasParent: false, fixed: [], regressed: [], newIssues: [] },
      uptime: { status, assessment: uptimeAssessment(status, clock.now()) } })!
  }
  it('confirms loops, retains the incident across inconclusive redirects, independently recovers and detects recurrence', async () => {
    await observe(1, 'FAILED', 'redirect_loop')
    expect(await prisma.uptimeIncident.count({ where: { monitorId } })).toBe(0)
    expect((await answerAvailability()).reply).toContain('An outage has not been confirmed')
    const original = await prisma.uptimeProbe.findFirstOrThrow({ where: { monitorId } })
    instant = (await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).confirmationDueAt!
    await observe(2, 'FAILED', 'redirect_loop')
    const incident = await prisma.uptimeIncident.findFirstOrThrow({ where: { monitorId } })
    expect(incident).toMatchObject({ reason: 'redirect_loop', recoveredAt: null, failureOrigin: null })
    expect(await loadUptimeSummary(uptimeReadSite({ id: projectId, userId }), clock.now())).toMatchObject({ state: 'offline', openIncidentCount: 1 })
    expect(await answerAvailability()).toMatchObject({ reply: expect.stringContaining('offline'), uptime: true, flagIds: [] })
    phase = 'chain'; await advance(); await observe(3, 'UNKNOWN', 'redirect_unresolved')
    phase = 'cookie'; await advance(); await observe(4, 'UNKNOWN', 'redirect_unresolved')
    phase = 'sign-in'; await advance(); await observe(5, 'UNKNOWN', 'access_blocked', 200)
    phase = 'challenge'; await advance(); await observe(6, 'UNKNOWN', 'access_blocked')
    phase = 'partial'; await advance(); await observe(7, 'UNKNOWN', 'probe_unavailable', 206)
    phase = 'not-modified'; await advance(); await observe(8, 'UNKNOWN', 'redirect_unresolved', 304)
    // Fetch without an authentication prompt reports HTTP 407 as a network error.
    phase = 'proxy-authentication'; await advance(); await observe(9, 'UNKNOWN', 'probe_unavailable', null)
    phase = 'network-authentication'; await advance(); await observe(10, 'UNKNOWN', 'access_blocked', 511)
    expect(requestedPaths).toContain('/account/login')
    expect(requestedPaths).toContain('/gate')
    expect(requestedPaths).not.toContain('/appears-available')
    expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: null })
    expect((await answerAvailability()).reply).toContain('unresolved uptime incident')
    expect(await prisma.uptimeNotification.count({ where: { incidentId: incident.id, kind: 'RECOVERED' } })).toBe(0)
    phase = 'cookie-repaired'; await advance()
    const repaired = await observe(11, 'ONLINE', 'response_received')
    expect(repaired).toMatchObject({ finalUrl: target + 'cookie-gate' })
    expect(JSON.stringify(repaired)).not.toContain(redirectToken)
    const legacyUrl = target + 'cookie-gate?token=' + redirectToken + '#private'
    // Model an older worker that recorded the full redirect URL.
    await prisma.uptimeProbe.update({ where: { id: repaired.id }, data: { finalUrl: legacyUrl } })
    const history = await loadUptimeHistory(uptimeReadSite({ id: projectId, userId }), '24h', null, clock.now())
    expect(history?.probes.find(probe => probe.id === repaired.id)).toMatchObject({ finalUrl: target + 'cookie-gate' })
    expect(JSON.stringify(history)).not.toContain(redirectToken)
    expect(await prisma.uptimeProbe.findUniqueOrThrow({ where: { id: repaired.id } })).toMatchObject({ finalUrl: legacyUrl })
    expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incident.id } })).toMatchObject({ recoveredAt: instant })
    expect((await answerAvailability('Is my website online?')).reply).toContain('found your website online')
    expect(await prisma.uptimeNotification.findMany({ where: { incidentId: incident.id }, orderBy: { createdAt: 'asc' } }))
      .toMatchObject([{ kind: 'DOWN', status: 'SKIPPED' }, { kind: 'RECOVERED', status: 'PENDING' }])
    phase = 'proxy-authentication'; await advance(); await observe(12, 'UNKNOWN', 'probe_unavailable', null)
    phase = 'network-authentication'; await advance(); await observe(13, 'UNKNOWN', 'access_blocked', 511)
    expect(await prisma.uptimeIncident.count({ where: { monitorId } })).toBe(1)
    expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).toMatchObject({ confirmationDueAt: null })
    phase = 'loop'; await advance(); await observe(14, 'FAILED', 'redirect_loop')
    instant = (await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).confirmationDueAt!
    await observe(15, 'FAILED', 'redirect_loop')
    expect(await prisma.uptimeIncident.count({ where: { monitorId } })).toBe(2)
    expect(await loadUptimeSummary(uptimeReadSite({ id: projectId, userId }), clock.now())).toMatchObject({ state: 'offline', openIncidentCount: 1 })
    expect((await answerAvailability('What should I do next?')).reply).toContain('offline')
    expect((await loadUptimeHistory(uptimeReadSite({ id: projectId, userId }), '24h', null, clock.now()))!.probes).toHaveLength(15)
    phase = 'repaired'; await advance(); await observe(16, 'ONLINE', 'response_received')
    phase = 'budget'; await advance()
    expect(await observe(17, 'UNKNOWN', 'redirect_unresolved')).toMatchObject({ finalUrl: target + 'budget/5' })
    expect(dns.missingLookups).toBe(0)
    expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).toMatchObject({ confirmationDueAt: null })
    expect(await prisma.uptimeIncident.count({ where: { monitorId } })).toBe(2)
    phase = 'socket-close'; await advance()
    const failureOrigin = new URL(target).origin
    expect(await observe(18, 'FAILED', 'connection_failed', null)).toMatchObject({ finalUrl: failureOrigin, confirmed: false })
    expect(await prisma.uptimeIncident.count({ where: { monitorId } })).toBe(2)
    instant = (await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).confirmationDueAt!
    expect(await observe(19, 'FAILED', 'connection_failed', null)).toMatchObject({ finalUrl: failureOrigin, confirmed: true })
    const socketIncident = await prisma.uptimeIncident.findFirstOrThrow({ where: { monitorId, reason: 'connection_failed' } })
    expect(socketIncident).toMatchObject({ failureOrigin, recoveredAt: null })
    expect(await loadUptimeSummary(uptimeReadSite({ id: projectId, userId }), clock.now())).toMatchObject({ state: 'offline', openIncidentCount: 1 })
    phase = 'repaired'; await advance(); await observe(20, 'ONLINE', 'response_received')
    expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: socketIncident.id } })).toMatchObject({ recoveredAt: instant })
    phase = 'dns'; await advance()
    expect(await observe(21, 'FAILED', 'dns_failure', null)).toMatchObject({ finalUrl: missingOrigin, confirmed: false })
    instant = (await prisma.uptimeMonitor.findUniqueOrThrow({ where: { id: monitorId } })).confirmationDueAt!
    expect(await observe(22, 'FAILED', 'dns_failure', null)).toMatchObject({ finalUrl: missingOrigin, confirmed: true })
    expect(dns.missingLookups).toBe(2)
    const dnsIncident = await prisma.uptimeIncident.findFirstOrThrow({ where: { monitorId, reason: 'dns_failure', recoveredAt: null } })
    expect(dnsIncident).toMatchObject({ targetUrl: target, failureOrigin: missingOrigin })
    expect(await prisma.uptimeProbe.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ auditsUsed: 3 })
    const afterRetention = new Date(instant.getTime() + UPTIME_RETENTION_MS + 1)
    expect(await retainUptimeHistory(afterRetention)).toBe(false)
    expect(await loadUptimeHistory(uptimeReadSite({ id: projectId, userId }), '24h', null, afterRetention)).toMatchObject({
      probes: [], openIncidentCount: 1,
      incidents: [{ id: dnsIncident.id, targetUrl: target, reason: 'dns_failure', failureOrigin: missingOrigin, recoveredAt: null }],
    })
  }, 30_000)
})
