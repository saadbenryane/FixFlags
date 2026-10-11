import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { prisma } from '@/lib/db'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { startWorker } from '@/lib/queue/worker'
import { recoverProgressiveAudits } from '@/lib/audit/progressive/runtime'
import { loadTasks } from '@/lib/audit/progressive/engine'
import { closeBrowser } from '@/lib/audit/screenshot'

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? ''), redis = new URL(process.env.REDIS_URL ?? '')
  assert.equal(database.hostname, 'localhost'); assert.equal(database.port, '55433'); assert.equal(database.pathname, '/search_acceptance')
  assert.equal(redis.hostname, 'localhost'); assert.equal(redis.port, '55434')
  const providerFixture = process.argv.includes('--provider-refusal-fixture')
  const realFetch = globalThis.fetch
  if (providerFixture) globalThis.fetch = async (input, options) => {
    const target = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url)
    if (target.hostname === 'www.googleapis.com' && target.pathname === '/pagespeedonline/v5/runPagespeed')
      return new Response('Explicit disposable provider-refusal fixture', { status: 403 })
    return realFetch(input, options)
  }
  process.env.DEV_ALLOW_LOCALHOST = 'true'
  const resume = process.env.FIXFLAGS_ACCEPTANCE_RESUME_AUDIT
    ? await prisma.audit.findUniqueOrThrow({ where: { id: process.env.FIXFLAGS_ACCEPTANCE_RESUME_AUDIT },
      include: { project: { include: { user: true } }, runRequests: true } }) : null
  if (resume) {
    assert.equal(new URL(resume.url).hostname, '127.0.0.1')
    assert.equal(resume.project?.name, 'Disposable progressive fixture')
    assert(resume.project.user.email.endsWith('@example.invalid'))
  }
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') { response.setHeader('content-type', 'text/plain'); response.end('User-agent: *\nAllow: /'); return }
    if (request.url === '/sitemap.xml') { response.setHeader('content-type', 'application/xml'); response.end('<urlset></urlset>'); return }
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
      '<body><header><nav><a href="#pricing">Pricing</a></nav></header><main><h1>Build better workflows</h1><p>Plan projects with your team.</p>' +
      '<a href="#pricing">Get started</a><section id="pricing"><h2>Plans</h2><p>Choose a plan.</p></section></main></body></html>')
  })
  await new Promise<void>(resolve => server.listen(resume ? Number(new URL(resume.url).port) : 0, '127.0.0.1', resolve))
  const address = server.address(); assert(address && typeof address !== 'string')
  const url = 'http://127.0.0.1:' + address.port + '/'
  const prefix = resume?.runRequests[0]?.idempotencyKey ?? 'progressive-browser-' + Date.now()
  const user = resume?.project?.user ?? await prisma.user.create({ data: { email: prefix + '@example.invalid' } })
  const site = resume?.project ?? await prisma.project.create({ data: { userId: user.id, url, canonicalHost: '127.0.0.1', name: 'Disposable progressive fixture' } })
  const worker = startWorker()
  try {
    const intent = { projectId: site.id, url, outcomeIds: [], userId: user.id, source: 'API' as const, scope: 'SITE' as const, idempotencyKey: prefix }
    const [first, repeated] = await Promise.all([requestSiteRun(intent), requestSiteRun(intent)])
    assert.equal(first.auditId, repeated.auditId); assert.equal(first.runId, repeated.runId)
    assert.equal(await prisma.audit.count({ where: { projectId: site.id } }), 1)
    assert.equal(await prisma.runRequest.count({ where: { projectId: site.id } }), 1)
    const started = Date.now(), deadline = started + 180_000
    let publishedBeforeSummary = false
    while (Date.now() < deadline) {
      await recoverProgressiveAudits()
      const audit = await prisma.audit.findUniqueOrThrow({ where: { id: first.auditId! } })
      assert.equal(audit.isPublic, false, 'An owned RunRequest must never publish private execution evidence')
      const flags = await prisma.flag.count({ where: { auditId: audit.id } })
      if (flags && audit.status !== 'COMPLETED') publishedBeforeSummary = true
      if (audit.status === 'COMPLETED') {
        const tasks = await loadTasks(audit.id)
        if (tasks.some(task => !['COMPLETED', 'BLOCKED', 'EXHAUSTED'].includes(task.workState!))) {
          await new Promise(resolve => setTimeout(resolve, 100))
          continue
        }
        assert(tasks.length > 20); assert(tasks.every(task => ['COMPLETED', 'BLOCKED', 'EXHAUSTED'].includes(task.workState!)))
        const browser = tasks.find(task => task.workKind === 'browser')
        assert.equal(browser?.workState, 'COMPLETED')
        const title = await prisma.flag.findFirst({ where: { auditId: audit.id, checkId: 'title-missing' } })
        assert(title); assert.equal((title.attentionPolicy as { kind: string }).kind, 'flag')
        assert(publishedBeforeSummary)
        console.log(JSON.stringify({ proof: 'progressive-real-browser-local', auditId: audit.id, tasks: tasks.length,
          independentPublication: publishedBeforeSummary, concurrentAdmissionDeduplicated: true, status: audit.status,
          providerEvidence: providerFixture ? 'explicit-refusal-fixture-not-live-provider-proof' : 'live-provider-responses',
          limitations: tasks.filter(task => task.workState !== 'COMPLETED').map(task => ({ kind: task.workKind, reason: task.workErrorCode })) }))
        return
      }
      if (audit.status === 'FAILED') throw new Error('Execution failed: ' + audit.failureCode)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: first.auditId! } })
    console.error(JSON.stringify({ auditId: audit.id, status: audit.status, tasks: (await loadTasks(audit.id)).map(task => ({
      key: task.targetKey, state: task.workState, reason: task.workErrorCode })) }))
    throw new Error('Local progressive acceptance deadline exceeded')
  } finally { await worker.close(); await closeBrowser(); globalThis.fetch = realFetch; await new Promise<void>(resolve => server.close(() => resolve())) }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1) })
