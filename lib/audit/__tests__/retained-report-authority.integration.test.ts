import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { auditAccessSourceSelect, canManageAudit, resolveAuditAccess } from '../access'
import { getGatedAuditForRequest } from '../fetch-audit'
import { saveOwnedReportProductContract } from '../save-product-contract'
import { buildUserProductContract } from '../product-contract'
import * as intelligence from '../product-intelligence'
import { assertAuditAccess } from '@/lib/mcp/access'
import { createShareGrant } from '@/lib/security/share-grant'
import { GET as screenshot } from '@/app/api/screenshots/[auditId]/[device]/route'

const boundary = vi.hoisted(() => ({ session: vi.fn(), image: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: boundary.session } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/storage/screenshots', () => ({ readScreenshot: boundary.image }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('live ownership of retained report evidence', () => {
  let owner: string, next: string, projectId: string, auditId: string
  const bytes = Buffer.from('retained-private-image')
  const contract = buildUserProductContract({ purpose: 'Help owners publish useful reports', firstValueJourney: 'Publish the first useful report', criticalOutcomes: ['The primary action works'] })
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    owner = (await prisma.user.create({ data: { email: randomUUID() + '@report-original.test', role: 'admin' } })).id
    next = (await prisma.user.create({ data: { email: randomUUID() + '@report-current.test', role: 'admin' } })).id
    projectId = (await prisma.project.create({ data: { userId: owner, url: 'https://example.com/', canonicalHost: 'example.com', name: 'Retained private report',
      productIntelligence: { purpose: 'Current private Site context', firstValueJourney: 'Use the private workflow', criticalOutcomes: ['Private outcome'],
        constraints: [], verifiedLearnings: [], intentionalNotes: [], knownRisks: [], source: 'user', updatedAt: new Date().toISOString() } } })).id
    auditId = (await prisma.audit.create({ data: { userId: owner, projectId, url: 'https://example.com/', isPublic: false,
      status: 'COMPLETED', completedAt: new Date(), triageAt: new Date(), includeAi: false,
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/', environment: 'production',
        checks: { 'buttons-no-text': 1 }, outcomes: [], verificationTarget: null } } })).id
    await prisma.flag.create({ data: { auditId, checkId: 'buttons-no-text', source: 'DETERMINISTIC', rubric: 'TRUST', severity: 'IMPORTANT',
      problem: 'The original control has no name', evidence: 'The recorded button has no accessible name', whyItMatters: 'Its purpose cannot be identified',
      fix: 'Name the original control', confidence: 1, position: 0 } })
    boundary.session.mockResolvedValue({ user: { id: owner } })
    boundary.image.mockResolvedValue(bytes)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await prisma.audit.deleteMany({ where: { id: auditId } })
    await prisma.project.deleteMany({ where: { userId: { in: [owner, next] } } })
    await prisma.user.deleteMany({ where: { id: { in: [owner, next] } } })
    boundary.session.mockReset(); boundary.image.mockReset()
  })
  async function source() { return prisma.audit.findUniqueOrThrow({ where: { id: auditId }, select: auditAccessSourceSelect }) }
  async function image() {
    return screenshot(new NextRequest(`http://localhost/api/screenshots/${auditId}/desktop`), { params: Promise.resolve({ auditId, device: 'desktop' }) })
  }

  it.each([false, true])('gives the current Site owner retained reports, fixes and screenshots after original actor erasure=%s', async erased => {
    const stale = await source()
    await prisma.project.update({ where: { id: projectId }, data: { userId: next } })
    if (erased) await prisma.user.delete({ where: { id: owner } })
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    expect(await resolveAuditAccess(stale, { id: owner })).toBe('denied')
    expect(await resolveAuditAccess(stale, { id: next })).toBe('owner')
    expect(await resolveAuditAccess({ ...stale, userId: null }, null, undefined, [auditId])).toBe('denied')
    expect(canManageAudit(await source(), { id: owner })).toBe(false)
    expect(canManageAudit(await source(), { id: next })).toBe(true)
    await expect(assertAuditAccess(stale, owner)).rejects.toThrow('Unauthorized')
    await expect(assertAuditAccess(stale, next)).resolves.toBeUndefined()
    const reads = vi.spyOn(prisma.audit, 'findUnique')
    expect(await getGatedAuditForRequest(auditId)).toEqual({ kind: 'forbidden' })
    expect(reads.mock.calls.some(([args]) => Boolean(args?.include))).toBe(false)
    reads.mockRestore()
    expect((await image()).status).toBe(404)
    boundary.session.mockResolvedValue({ user: { id: next } })
    const report = await getGatedAuditForRequest(auditId)
    expect(report).toMatchObject({ kind: 'ok', accessContext: 'owner', showDeterministicFixes: true,
      audit: { userId: erased ? null : owner, project: { id: projectId }, flags: [{ fix: 'Name the original control' }] } })
    const response = await image()
    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toEqual(original)
  })

  it.each(['removed', 'SUSPENDED', 'DELETING'] as const)('refuses retained private access when the Site is %s', async state => {
    const stale = await source()
    if (state === 'removed') await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } })
    else await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus: state } })
    expect(await resolveAuditAccess(stale, { id: owner })).toBe('denied')
    expect(await getGatedAuditForRequest(auditId)).toEqual({ kind: 'forbidden' })
    expect((await image()).status).toBe(404)
  })

  it('uses recorded public visibility and keeps the public compatibility view separate from owner context', async () => {
    const stale = await source()
    expect(await resolveAuditAccess({ ...stale, isPublic: true }, { id: next })).toBe('denied')
    await prisma.audit.update({ where: { id: auditId }, data: { isPublic: true } })
    await prisma.project.update({ where: { id: projectId }, data: { userId: next } })
    expect(await resolveAuditAccess(stale, { id: owner })).toBe('public_viewer')
    expect(await getGatedAuditForRequest(auditId)).toMatchObject({ kind: 'ok', accessContext: 'public_viewer', showDeterministicFixes: false,
      audit: { project: null, productContract: null, flags: [{ fix: null }] } })
  })

  it('retains explicit shared evidence after transfer and refuses its revoked grant', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'retained-report-fixture-signing-secret')
    const stale = await source()
    const link = await prisma.shareLink.create({ data: { auditId, token: randomUUID() } })
    const grant = createShareGrant({ auditId, linkId: link.id, linkVersion: link.version }).value
    await prisma.project.update({ where: { id: projectId }, data: { userId: next } })
    expect(await resolveAuditAccess(stale, { id: owner }, grant)).toBe('share_grant')
    expect(canManageAudit(await source(), { id: owner })).toBe(false)
    await prisma.shareLink.update({ where: { id: link.id }, data: { revoked: true } })
    expect(await resolveAuditAccess(stale, { id: owner }, grant)).toBe('denied')
  })

  it('retains standalone creator and signed anonymous access without lending it to an attached Site', async () => {
    await prisma.audit.update({ where: { id: auditId }, data: { projectId: null } })
    const stale = await source()
    expect(await resolveAuditAccess(stale, { id: owner })).toBe('owner')
    expect(await resolveAuditAccess(stale, { id: next })).toBe('denied')
    await prisma.audit.update({ where: { id: auditId }, data: { userId: null } })
    expect(await resolveAuditAccess(stale, null, undefined, [auditId])).toBe('anonymous_teaser')
    await prisma.audit.update({ where: { id: auditId }, data: { projectId } })
    expect(await resolveAuditAccess(stale, null, undefined, [auditId])).toBe('denied')
  })

  it('refuses an owner response if the Site transfers while private captures are being read', async () => {
    boundary.image.mockImplementationOnce(async () => {
      await prisma.project.update({ where: { id: projectId }, data: { userId: next } })
      return bytes
    })
    expect((await image()).status).toBe(404)
  })

  it('refuses an owner report if authority changes while its remaining evidence is read', async () => {
    const read = prisma.$queryRaw.bind(prisma) as (...args: unknown[]) => Promise<unknown[]>
    let transferred = false
    vi.spyOn(prisma, '$queryRaw').mockImplementation((async (...args: unknown[]) => {
      const rows = await read(...args)
      if (!transferred) { transferred = true; await prisma.project.update({ where: { id: projectId }, data: { userId: next } }) }
      return rows
    }) as never)
    expect(await getGatedAuditForRequest(auditId)).toEqual({ kind: 'forbidden' })
    expect(transferred).toBe(true)
  })

  it.each([false, true])('commits retained report context and Site memory without changing original authorship (erased=%s)', async erased => {
    await prisma.project.update({ where: { id: projectId }, data: { userId: next } })
    if (erased) await prisma.user.delete({ where: { id: owner } })
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    await expect(saveOwnedReportProductContract(auditId, owner, contract)).rejects.toMatchObject({ status: 403 })
    expect(await saveOwnedReportProductContract(auditId, next, contract)).toMatchObject({ id: auditId, projectId, productContract: contract })
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).productIntelligence).toMatchObject({ purpose: contract.purpose })
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).userId).toBe(original.userId)
  })

  it('refuses context mutation for an inactive account without changing retained evidence', async () => {
    await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus: 'SUSPENDED' } })
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    await expect(saveOwnedReportProductContract(auditId, owner, contract)).rejects.toMatchObject({ status: 403 })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toEqual(original)
  })

  it.each([false, true])('rolls back report context and Site memory together (unattached=%s)', async unattached => {
    if (unattached) await prisma.audit.update({ where: { id: auditId }, data: { projectId: null } })
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }), project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    vi.spyOn(intelligence, 'mergeContractIntoProductIntelligence').mockImplementationOnce(() => { throw new Error('Controlled context failure') })
    await expect(saveOwnedReportProductContract(auditId, owner, contract)).rejects.toThrow('Controlled context failure')
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toEqual(audit)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(project)
  })

  it('rechecks a transfer after acquiring the Site lock before changing report or current memory', async () => {
    let release!: () => void, announce!: () => void
    const released = new Promise<void>(resolve => { release = resolve }), locked = new Promise<void>(resolve => { announce = resolve })
    const transfer = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`
      announce(); await released
      await tx.project.update({ where: { id: projectId }, data: { userId: next } })
    }, { timeout: 15_000 })
    await locked
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    const saving = saveOwnedReportProductContract(auditId, owner, contract).then(value => ({ value, error: null }), error => ({ value: null, error }))
    try {
      await vi.waitFor(async () => {
        const [row] = await prisma.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'
            AND query LIKE '%SELECT id FROM projects WHERE id =%'`
        expect(row.count).toBe(1)
      }, { timeout: 5000, interval: 25 })
    } finally { release(); await transfer }
    expect((await saving).error).toMatchObject({ status: 403 })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toEqual(audit)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).productIntelligence).toMatchObject({ purpose: 'Current private Site context' })
  })
})
