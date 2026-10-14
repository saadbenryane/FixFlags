import { randomUUID, createHmac } from 'node:crypto'
import { createServer } from 'node:https'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { getAuditBrowser, getBrowserDiagnostics, closeBrowser } from '@/lib/audit/screenshot'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { loadAccountChecksView } from '@/lib/sites/accounts/store'
import { accountCheckId } from '@/lib/sites/accounts/check-definitions'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { POST as receiveEmail } from '@/app/api/webhooks/resend/receiving/route'
import { NextRequest } from 'next/server'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('disposable HTTPS automatic account lifecycle', () => {
  const userId = 'account-lifecycle-' + randomUUID(), projectId = 'account-lifecycle-' + randomUUID()
  const users = new Map<string, { password: string; verified: boolean }>()
  const sessions = new Map<string, string>(), emails = new Map<string, { email: string; token: string; createdAt: string }>()
  const confirmations = new Map<string, string>(), signingKey = Buffer.alloc(32, 3)
  let origin = '', signupCount = 0, deletionCount = 0, receivingCount = 0, providerReads = 0, broken = false, deletionBroken = false
  let worker: ReturnType<typeof startWorker> | undefined
  let directory: string, server: ReturnType<typeof createServer>
  const page = (body: string) => '<!doctype html><html lang="en"><head><title>Account lifecycle fixture</title></head><body><main><h1>Account lifecycle fixture</h1>' + body + '</main></body></html>'
  const form = (kind: 'signup' | 'login') => page('<form method="post" action="/api/' + kind + '"><label>Email<input type="email" name="email" autocomplete="email" required></label>' +
    '<label>Password<input type="password" name="password" autocomplete="' + (kind === 'signup' ? 'new-password' : 'current-password') + '" required></label><button type="submit">' + (kind === 'signup' ? 'Create account' : 'Log in') + '</button></form>')
  beforeAll(async () => {
    const db = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(db.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(db.pathname)) throw new Error('Use the disposable execution verifier')
    directory = mkdtempSync(join(tmpdir(), 'fixflags-account-tls-'))
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost',
      '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem')], { stdio: 'ignore' })
    server = createServer({ key: readFileSync(join(directory, 'key.pem')), cert: readFileSync(join(directory, 'cert.pem')) }, async (req, res) => {
      try {
        const url = new URL(req.url!, origin)
        const sessionId = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1]
        const email = sessionId ? sessions.get(sessionId) : undefined
        const signed = email && users.get(email)?.verified
        const enter = (email: string) => {
          const id = randomUUID(); sessions.set(id, email)
          res.setHeader('set-cookie', 'session=' + id + '; Path=/; Secure; HttpOnly; SameSite=Lax')
          res.writeHead(303, { location: '/dashboard' }); res.end()
        }
        res.setHeader('content-type', 'text/html')
        if (req.method === 'POST') {
          let raw = ''; for await (const chunk of req) raw += chunk
          const data = new URLSearchParams(raw), submittedEmail = data.get('email')!, password = data.get('password')!
          if (url.pathname === '/api/signup') {
            signupCount++; users.set(submittedEmail, { password, verified: false })
            const token = randomUUID(), id = randomUUID(), createdAt = new Date().toISOString()
            confirmations.set(token, submittedEmail); emails.set(id, { email: submittedEmail, token, createdAt })
            const payload = JSON.stringify({ type: 'email.received', data: { email_id: id, to: [submittedEmail], created_at: createdAt } })
            const timestamp = String(Math.floor(Date.now() / 1000)), messageId = 'msg_' + id
            const signature = createHmac('sha256', signingKey).update(`${messageId}.${timestamp}.${payload}`).digest('base64')
            const receivingRequest = (value: string) => new NextRequest(origin + '/receiving-fixture', { method: 'POST', body: payload,
              headers: { 'svix-id': messageId, 'svix-timestamp': timestamp, 'svix-signature': value } })
            expect((await receiveEmail(receivingRequest('v1,invalid'))).status).toBe(400)
            const result = await receiveEmail(receivingRequest('v1,' + signature))
            expect(result.status).toBe(200); receivingCount++
            expect((await receiveEmail(receivingRequest('v1,' + signature))).status).toBe(200)
            res.end(page('<p>Verify your email</p><a href="/login">Log in</a>')); return
          }
          if (url.pathname === '/api/login') {
            const user = users.get(submittedEmail)
            if (user?.verified && user.password === password) { enter(submittedEmail); return }
            res.end(page('<p role="alert">Invalid credentials</p>')); return
          }
          if (url.pathname === '/api/account/delete' && signed) {
            if (!deletionBroken) { deletionCount++; users.delete(email!) }
            sessions.delete(sessionId!)
            res.setHeader('set-cookie', 'session=; Path=/; Secure; Max-Age=0'); res.end('Deleted'); return
          }
          res.writeHead(400); res.end('Unsupported fixture operation'); return
        }
        if (url.pathname === '/verify') {
          const verifiedEmail = confirmations.get(url.searchParams.get('token') ?? '')
          if (verifiedEmail && users.has(verifiedEmail)) { users.get(verifiedEmail)!.verified = true; enter(verifiedEmail); return }
          res.writeHead(400); res.end('Invalid confirmation'); return
        }
        if (url.pathname === '/signup') { res.end(form('signup')); return }
        if (url.pathname === '/login') { res.end(form('login')); return }
        if (url.pathname === '/dashboard' || url.pathname === '/settings') {
          if (!signed) { res.writeHead(303, { location: '/login' }); res.end(); return }
          if (broken && url.pathname === '/dashboard') res.statusCode = 503
          res.end(page('<button>Sign out</button><a href="/settings">Settings</a><button onclick="fetch(\'/api/account/delete\',{method:\'POST\'}).then(()=>location.href=\'/login\')">Delete account</button>')); return
        }
        res.end(page('<a href="/signup">Create account</a><a href="/login">Log in</a>'))
      } catch (error) { res.statusCode = 500; res.end(String(error)) }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    origin = 'https://127.0.0.1:' + (server.address() as { port: number }).port
    for (const [key, value] of Object.entries({ DEV_ALLOW_LOCALHOST: 'true', ACCOUNT_CHECKS_ENABLED: 'true', ACCOUNT_CHECKS_LIFECYCLE_VERIFIED: 'false',
      RAILWAY_ENVIRONMENT_NAME: 'public-validation', ACCOUNT_CHECKS_VALIDATION_ORIGIN: origin, ACCOUNT_TEST_EMAIL: 'checks@fixture.test',
      RESEND_API_KEY: 'fixture-receiving-only', RESEND_RECEIVING_WEBHOOK_SECRET: 'whsec_' + signingKey.toString('base64') })) vi.stubEnv(key, value)
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== 'https://api.resend.com' || !url.pathname.startsWith('/emails/receiving/')) throw new Error('External transport is unavailable in this fixture')
      providerReads++
      const mail = emails.get(url.pathname.split('/').at(-1)!)!
      return new Response(JSON.stringify({ to: [mail.email], created_at: mail.createdAt,
        html: '<a href="' + origin + '/verify?token=' + mail.token + '">Confirm email</a>' }))
    })
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', auditsLimit: 100 } })
    await prisma.project.create({ data: { id: projectId, userId, name: 'HTTPS account fixture', url: origin + '/', canonicalHost: '127.0.0.1' } })
    const browser = await getAuditBrowser(), newContext = browser.newContext.bind(browser)
    vi.spyOn(browser, 'newContext').mockImplementation(options => newContext({ ...options, ignoreHTTPSErrors: true }))
    worker = startWorker(); await worker.waitUntilReady()
    const diagnostics = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: diagnostics.connected, activeBrowserContexts: diagnostics.activeContexts, queueState: 'idle' })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    for (const queue of [getAuditQueue(), ...(['http', 'browser', 'provider', 'evaluate', 'availability'] as const).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server?.closeAllConnections(); if (server) await new Promise<void>(resolve => server.close(() => resolve()))
    if (directory) rmSync(directory, { recursive: true, force: true })
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); await prisma.$disconnect()
  })
  async function check(key: string, mode: 'routine' | 'cleanup' | 'retest' = 'routine') {
    const result = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', scope: 'ACCOUNT_CHECKS', accountMode: mode, idempotencyKey: key })
    await vi.waitFor(async () => expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: result.runId } })).toMatchObject({ status: 'COMPLETED' }), { timeout: 90_000, interval: 200 })
    return result
  }
  it('verifies signup and email, reuses the retained identity, flags signed-in failures and cleans up after opt-out', async () => {
    const first = await check('account-lifecycle-initial')
    expect(signupCount).toBe(2); expect(receivingCount).toBe(2); expect(providerReads).toBe(2); expect(deletionCount).toBe(1)
    const accounts = await prisma.siteTestAccount.findMany({ where: { projectId } })
    expect(accounts).toEqual(expect.arrayContaining([expect.objectContaining({ purpose: 'retained', state: 'ACTIVE', encryptedSession: expect.any(String) }),
      expect.objectContaining({ purpose: 'disposable', state: 'DELETED', deletionVerifiedAt: expect.any(Date) })]))
    expect(await getOwnedRun(userId, first.runId)).toMatchObject({ result: 'CLEAR' })
    const messages = await prisma.siteAccountMessage.findMany({ where: { account: { projectId } } })
    expect(JSON.stringify(messages)).not.toContain('/verify?token=')
    await check('account-lifecycle-repeat')
    expect(signupCount).toBe(2); expect(deletionCount).toBe(1)
    broken = true
    const failed = await check('account-lifecycle-failed')
    expect(await prisma.flag.findMany({ where: { auditId: failed.auditId! } })).toEqual(expect.arrayContaining([expect.objectContaining({ checkId: accountCheckId.signed_in })]))
    expect(await getOwnedRun(userId, failed.runId)).toMatchObject({ result: 'FLAG' })
    const view = await loadAccountChecksView(projectId)
    expect(view.results.some(item => item.state === 'failed')).toBe(true)
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: failed.auditId!, checkId: accountCheckId.signed_in } })
    broken = false
    const fix = await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'account-lifecycle-fix', changeSummary: 'Restore the signed-in page response' })
    const repaired = await requestSiteRun({ projectId, userId, outcomeIds: [], source: 'WEB', idempotencyKey: 'account-lifecycle-verify',
      verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: flag.pageUrl!, checkId: accountCheckId.signed_in, parentAuditId: failed.auditId!, attemptId: fix.attemptId } })
    await vi.waitFor(async () => expect(await prisma.audit.findUniqueOrThrow({ where: { id: repaired.auditId! } })).toMatchObject({ improvementProjectedAt: expect.any(Date) }), { timeout: 90_000, interval: 200 })
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'FIXED' })
    broken = true
    const recurring = await check('account-lifecycle-recurrence')
    const recurrence = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId!, checkId: accountCheckId.signed_in } })
    expect(recurrence).toMatchObject({ status: 'REGRESSED', fingerprint: flag.fingerprint })
    const attempt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurrence.id } })).toMatchObject({ improvementId: attempt.improvementId })
    expect(signupCount).toBe(2)
    broken = false; deletionBroken = true
    const deletionFailed = await check('account-lifecycle-deletion-failed', 'retest')
    expect(signupCount).toBe(3)
    expect(await prisma.flag.findMany({ where: { auditId: deletionFailed.auditId! } })).toEqual(expect.arrayContaining([expect.objectContaining({ checkId: accountCheckId.deletion })]))
    expect(await prisma.siteTestAccount.findFirstOrThrow({ where: { projectId, purpose: 'disposable' } })).toMatchObject({ state: 'ACTIVE' })
    await check('account-lifecycle-unresolved-slot')
    expect(signupCount).toBe(3)
    const artifacts = await prisma.auditVerifierExecution.findMany({ where: { auditId: first.auditId!, workKind: 'automatic-accounts' }, select: { workResult: true } })
    for (const account of accounts) expect(JSON.stringify(artifacts)).not.toContain(account.email)
    deletionBroken = false
    await prisma.project.update({ where: { id: projectId }, data: { accountChecksEnabled: false, accountCheckRevision: { increment: 1 } } })
    vi.stubEnv('ACCOUNT_CHECKS_ENABLED', 'false'); vi.stubEnv('RESEND_RECEIVING_WEBHOOK_SECRET', '')
    await check('account-lifecycle-cleanup', 'cleanup')
    expect(deletionCount).toBe(3)
    expect(await prisma.siteTestAccount.count({ where: { projectId, state: { not: 'DELETED' } } })).toBe(0)
    expect(users.size).toBe(0)
  }, 240_000)
})
