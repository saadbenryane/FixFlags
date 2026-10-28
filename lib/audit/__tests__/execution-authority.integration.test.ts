import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { accountAdmission, assertAccountPermission, reserveAccount } from '@/lib/sites/accounts/store'
import { claimExecution, currentExecutionOwnership, executionTransaction, executionWrite, ExecutionOwnershipLost,
  renewExecution, withExecutionOwnership, type ExecutionOwnership } from '../execution-ownership'
import { executeTask } from '../progressive/engine'
import { serializeArtifact } from '../progressive/contracts'
import type { TaskHandler } from '../progressive/registry'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { createAuditPage, type AuditPageSession } from '../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../browser/capture-profile'
import { browserCapacity } from '../progressive/capacity'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('execution Site authority', () => {
  const users: string[] = []
  const unlinkedAudits: string[] = []
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await prisma.audit.deleteMany({ where: { OR: [{ userId: { in: users } }, { id: { in: unlinkedAudits.splice(0) } }] } })
    await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } })
  })
  afterAll(async () => { await closeBrowser(); await prisma.$disconnect() })
  async function user() {
    const created = await prisma.user.create({ data: { email: randomUUID() + '@execution.test', role: 'admin' } })
    users.push(created.id)
    return created
  }
  async function fixture(task = false, cleanup = false) {
    const original = await user(), replacement = await user()
    const project = await prisma.project.create({ data: { userId: original.id, name: 'Execution authority fixture',
      canonicalHost: randomUUID() + '.example.test', url: 'https://example.com/' } })
    const token = randomUUID()
    const audit = await prisma.audit.create({ data: { userId: original.id, projectId: project.id, url: project.url,
      status: 'CHECKING', executionToken: token, executionGeneration: 1, executionLeaseUntil: new Date(Date.now() + 60_000),
      ...(cleanup ? { executionSpec: { scope: 'ACCOUNT_CHECKS', accountChecks: { mode: 'cleanup' } } } : {}) } })
    const owner: ExecutionOwnership = { auditId: audit.id, token, generation: 1 }
    if (task) {
      const row = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:account',
        source: 'DETERMINISTIC', status: 'RUNNING', workKind: 'account', workState: 'RUNNING', workToken: token,
        workGeneration: 1, workLeaseUntil: new Date(Date.now() + 60_000) } })
      owner.taskId = row.id
    }
    return { original, replacement, project, audit, owner }
  }
  it.each([false, true])('refuses a stale write after transfer (task=%s)', async task => {
    const { project, replacement, audit, owner } = await fixture(task)
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    await expect(withExecutionOwnership(owner, () => executionWrite(tx => tx.audit.update({ where: { id: audit.id },
      data: { errorMsg: 'Former owner write' } })))).rejects.toBeInstanceOf(ExecutionOwnershipLost)
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).errorMsg).toBeNull()
  })
  it('refuses coordinator admission without consuming another generation after transfer', async () => {
    const { project, replacement, audit } = await fixture()
    await prisma.audit.update({ where: { id: audit.id }, data: { executionLeaseUntil: new Date(0) } })
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    expect(await claimExecution(audit.id, { resume: true })).toBeNull()
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).executionGeneration).toBe(1)
  })
  it('refuses task admission without consuming a protected attempt after transfer', async () => {
    const { project, replacement, audit } = await fixture()
    const task = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:http',
      source: 'DETERMINISTIC', status: 'PENDING', workKind: 'http', workState: 'READY',
      workInput: { pageUrl: project.url, position: 0, primary: true, role: 'primary' } } })
    const evaluate = vi.fn(async () => serializeArtifact('http', { observed: true }))
    const handlers = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only', timeoutMs: 5000,
      evaluate, validateResult: () => {} }]])
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    await executeTask({ auditId: audit.id, taskId: task.id, generation: 1 }, handlers)
    expect(evaluate).not.toHaveBeenCalled()
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } }))
      .toMatchObject({ workState: 'READY', workGeneration: 0, workAttempts: 0, workToken: null })
  })
  it.each([false, true])('refuses to renew a transferred execution (task=%s)', async task => {
    const { project, replacement, owner } = await fixture(task)
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    expect(await renewExecution(owner)).toBe(false)
  })
  it.each([false, true])('renews only a live matching lease (task=%s)', async task => {
    const { owner, audit } = await fixture(task)
    expect(await renewExecution(owner)).toBe(true)
    expect(await renewExecution({ ...owner, token: 'obsolete-token' })).toBe(false)
    expect(await renewExecution({ ...owner, generation: 0 })).toBe(false)
    if (owner.taskId) await prisma.auditExecutionTask.update({ where: { id: owner.taskId }, data: { workLeaseUntil: new Date(0) } })
    else await prisma.audit.update({ where: { id: audit.id }, data: { executionLeaseUntil: new Date(0) } })
    expect(await renewExecution(owner)).toBe(false)
  })
  it.each([false, true])('retains cleanup for the same owner after deactivation, never after transfer (task=%s)', async task => {
    const { original, replacement, project, owner } = await fixture(task, true)
    await prisma.user.update({ where: { id: original.id }, data: { lifecycleStatus: 'DELETING' } })
    await prisma.project.update({ where: { id: project.id }, data: { deletedAt: new Date(), accountChecksEnabled: false } })
    expect(await renewExecution(owner)).toBe(true)
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    expect(await renewExecution(owner)).toBe(false)
    await expect(withExecutionOwnership(owner, () => executionTransaction(async () => 'cleanup admitted')))
      .rejects.toBeInstanceOf(ExecutionOwnershipLost)
  })
  it('preserves an anonymous execution when its Audit is attached to its claiming owner', async () => {
    const claimant = await user(), token = randomUUID()
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', status: 'CHECKING',
      executionToken: token, executionGeneration: 1, executionLeaseUntil: new Date(Date.now() + 60_000) } })
    unlinkedAudits.push(audit.id)
    const project = await prisma.project.create({ data: { userId: claimant.id, name: 'Claimed Site',
      canonicalHost: 'claimed.example.test', url: audit.url } })
    await withExecutionOwnership({ auditId: audit.id, token, generation: 1 }, async () => {
      await executionWrite(tx => tx.audit.update({ where: { id: audit.id }, data: { progress: 10 } }))
      await prisma.audit.update({ where: { id: audit.id }, data: { userId: claimant.id, projectId: project.id } })
      expect(await renewExecution(currentExecutionOwnership()!)).toBe(true)
      await executionWrite(tx => tx.audit.update({ where: { id: audit.id }, data: { progress: 20 } }))
    })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({
      userId: claimant.id, projectId: project.id, executionToken: token, executionGeneration: 1, progress: 20,
    })
  })
  it('holds the Site fence through the observation commit', async () => {
    const { project, replacement, owner, audit } = await fixture()
    let locked!: () => void, release!: () => void
    const holding = new Promise<void>(resolve => { locked = resolve }), gate = new Promise<void>(resolve => { release = resolve })
    const writing = withExecutionOwnership(owner, () => executionWrite(async tx => {
      locked(); await gate
      await tx.audit.update({ where: { id: audit.id }, data: { errorMsg: 'Authorized observation' } })
    }))
    try {
      await holding
      await expect(prisma.$transaction(async tx => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '150ms'`
        await tx.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
      })).rejects.toThrow(/lock timeout/)
    } finally { release(); await writing }
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).errorMsg).toBe('Authorized observation')
  })
  it('physically closes native browser work when its Site transfers', async () => {
    const { project, replacement, owner } = await fixture(true)
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'text/html')
      response.end('<!doctype html><html><head><title>Authority fixture</title></head><body><h1>Owned observation</h1></body></html>')
    })
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    let session: AuditPageSession | undefined, signal: AbortSignal | undefined
    const running = withExecutionOwnership(owner, async () => {
      signal = currentExecutionOwnership()!.signal!
      session = await createAuditPage(await getAuditBrowser(), origin, { profile: DESKTOP_CAPTURE_PROFILE,
        allowLocalhost: true, settle: false, deadline: Date.now() + 15_000 })
      await session.page.waitForTimeout(30_000)
    }).catch(error => error)
    try {
      await vi.waitFor(() => expect(session).toBeDefined(), { timeout: 10_000 })
      expect(browserCapacity.running).toBe(1)
      await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
      await vi.waitFor(() => {
        expect(signal?.aborted).toBe(true)
        expect(session!.page.isClosed()).toBe(true)
        expect(browserCapacity.running).toBe(0)
      }, { timeout: 5_000 })
      expect(await running).toBeInstanceOf(Error)
      expect((await getAuditBrowser()).isConnected()).toBe(true)
    } finally {
      await session?.page.context().close()
      await running
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
  it('cannot borrow the new owner eligibility for account actions', async () => {
    for (const [key, value] of Object.entries({ ACCOUNT_CHECKS_ENABLED: 'true', ACCOUNT_CHECKS_LIFECYCLE_VERIFIED: 'true',
      ACCOUNT_CHECKS_VALIDATION_ORIGIN: '', ACCOUNT_TEST_EMAIL: 'checks@fixture.test', RESEND_API_KEY: 'fixture-only',
      RESEND_RECEIVING_WEBHOOK_SECRET: 'fixture-only' })) vi.stubEnv(key, value)
    const { project, replacement, owner } = await fixture(true)
    const admitted = await accountAdmission(project.id)
    expect(admitted).toBeDefined()
    const reserve = (intent: NonNullable<typeof admitted>) => reserveAccount({ projectId: project.id,
      origin: 'https://example.com', purpose: 'retained', signupUrl: 'https://example.com/signup',
      loginUrl: 'https://example.com/login', fingerprint: 'fixture', intent })
    const identity = await reserve(admitted!)
    await prisma.project.update({ where: { id: project.id }, data: { userId: replacement.id } })
    await expect(withExecutionOwnership(owner, () => executionTransaction(tx => assertAccountPermission(project.id, admitted!, tx))))
      .rejects.toBeInstanceOf(ExecutionOwnershipLost)
    // A fresh run keeps automatic defaults and the Site's service-created identity.
    const newAdmission = await accountAdmission(project.id)
    expect(newAdmission).toEqual(admitted)
    const current = await prisma.audit.create({ data: { projectId: project.id, userId: replacement.id, url: project.url,
      status: 'CHECKING', executionToken: 'new-owner', executionGeneration: 1, executionLeaseUntil: new Date(Date.now() + 60_000) } })
    expect((await withExecutionOwnership({ auditId: current.id, token: 'new-owner', generation: 1 }, () => reserve(newAdmission!))).id)
      .toBe(identity.id)
  })
})
