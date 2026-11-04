import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlags } from '@/lib/sites/flags'
import { sendSiteAgentMessage } from '../agent'

const model = vi.hoisted(() => vi.fn())
vi.mock('@/lib/workspace/chat', async original => ({ ...await original<typeof import('@/lib/workspace/chat')>(), runWorkspaceChat: model }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Site agent canonical evidence', () => {
  let userId: string, projectId: string, auditId: string
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = (await prisma.user.create({ data: { email: randomUUID() + '@agent-facts.example' } })).id
    projectId = (await prisma.project.create({ data: { userId, canonicalHost: 'example.com', url: 'https://example.com/', name: 'Evidence fixture' } })).id
    auditId = (await prisma.audit.create({ data: { userId, projectId, url: 'https://example.com/', status: 'COMPLETED', completedAt: new Date() } })).id
    model.mockReset().mockRejectedValue(new Error('External model calls are disabled in this local fixture'))
  })
  afterEach(async () => { vi.restoreAllMocks(); await prisma.user.deleteMany({ where: { id: userId } }) })
  const ask = (message: string, flagId?: string) => sendSiteAgentMessage({ siteId: projectId, userId,
    requestKey: randomUUID(), message, ...(flagId ? { flagId } : {}) })
  const capture = (data: Partial<Prisma.FlagUncheckedCreateInput> = {}) => prisma.flag.create({ data: { auditId,
    checkId: 'title-missing', fingerprint: 'missing-title', source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT',
    problem: 'Page title is missing', evidence: 'The captured title is empty.', whyItMatters: 'Visitors cannot identify this page.',
    fix: 'Add a descriptive page title.', verificationRule: 'The same page has a descriptive title.', pageUrl: 'https://example.com/',
    confidence: 1, position: 0, ...data } })
  async function incident(flag: Awaited<ReturnType<typeof capture>>, status: 'PROPOSED' | 'VERIFIED' = 'PROPOSED', priority = 0) {
    return prisma.improvement.create({ data: { projectId, fingerprint: flag.fingerprint!, title: flag.problem,
      judgment: flag.whyItMatters, expectedBenefit: flag.whyItMatters, recommendedChange: flag.fix, successCondition: flag.verificationRule!, status, priority,
      occurrences: { create: { auditId: flag.auditId, flagId: flag.id, kind: 'OBSERVED', createdAt: flag.createdAt } } } })
  }

  it('answers from confirmed findings before Improvement materialization', async () => {
    const flag = await capture()
    expect(await loadSiteFlags((await loadSiteRecord(projectId))!)).toMatchObject([{ sourceFlagId: flag.id }])
    const answer = await ask("What's unresolved?")
    expect(answer.reply).toContain(flag.problem)
    expect(answer.citations).toEqual(expect.arrayContaining([expect.objectContaining({ id: flag.id })]))
    expect(model).not.toHaveBeenCalled()
  })

  it('does not certify recovery from a verified Improvement without independent proof', async () => {
    const flag = await capture()
    await incident(flag, 'VERIFIED')
    expect(await loadSiteFlags((await loadSiteRecord(projectId))!)).toMatchObject([{ sourceFlagId: flag.id, status: 'OPEN' }])
    expect((await ask('Is the page title fixed?')).reply).not.toMatch(/^Yes\./)
    expect(model).not.toHaveBeenCalled()
  })

  it('chooses the same highest priority repair as the Site board', async () => {
    const critical = await capture({ severity: 'CRITICAL' })
    const lower = await capture({ checkId: 'security-csp-unsafe-inline', fingerprint: 'inline-scripts', problem: 'Script policy permits unsafe inline code',
      severity: 'IMPORTANT', position: 1 })
    await incident(critical, 'PROPOSED', 1)
    await incident(lower, 'PROPOSED', 100)
    const board = await loadSiteFlags((await loadSiteRecord(projectId))!)
    expect(board[0].sourceFlagId).toBe(critical.id)
    const answer = await ask('What should I fix first?')
    expect(answer.reply).toContain(critical.problem)
    expect(answer.reply).not.toContain(lower.problem)
    expect(model).not.toHaveBeenCalled()
  })

  it('does not let a materialized lower-priority repair outrank a confirmed unbound failure', async () => {
    const critical = await capture({ severity: 'CRITICAL' })
    const lower = await capture({ checkId: 'security-csp-unsafe-inline', fingerprint: 'inline-scripts', problem: 'Script policy permits unsafe inline code', position: 1 })
    await incident(lower)
    const answer = await ask('What should I fix first?')
    expect(answer.reply.indexOf(critical.problem)).toBeGreaterThanOrEqual(0)
    expect(answer.reply.indexOf(critical.problem)).toBeLessThan(answer.reply.indexOf(lower.problem))
    expect(model).not.toHaveBeenCalled()
  })

  it('retains every current finding for deterministic answers while bounding open-ended model context', async () => {
    const rows = await Promise.all(Array.from({ length: 14 }, (_, index) => capture({ checkId: 'title-missing::page:' + index,
      fingerprint: 'title-' + index, pageUrl: 'https://example.com/page-' + index, problem: 'Page ' + index + ' title is missing',
      severity: index === 13 ? 'CRITICAL' : 'IMPORTANT', position: index })))
    expect((await ask("What's unresolved?")).reply).toContain('14 unresolved flags')
    expect(model).not.toHaveBeenCalled()
    model.mockResolvedValueOnce({ reply: 'Local evidence response', usage: { inputTokens: 1, outputTokens: 1 } })
    await ask('Explain the title evidence in detail')
    const supplied = model.mock.calls[0][0]
    expect(supplied.flags).toHaveLength(12)
    expect(supplied.flags[0]).toMatchObject({ id: rows[13].id, verificationState: 'still_open', pageUrl: rows[13].pageUrl })
    expect(supplied.findingScope).toEqual({ kind: 'site', currentCount: 14, recentRecoveryCount: 0 })
    const target = rows.find(row => !supplied.flags.slice(0, 3).some((flag: { id: string }) => flag.id === row.id))!
    const specific = await ask('Is ' + target.problem.replace(' is missing', '') + ' fixed?')
    expect(specific.citations.filter(citation => citation.type === 'flag')).toEqual([
      expect.objectContaining({ id: target.id, href: `/sites/${projectId}/flags/${target.id}` }),
    ])
  })

  it('reports an admitted check even after newer repair drafts', async () => {
    const flag = await capture(), improvement = await incident(flag)
    const check = await prisma.audit.create({ data: { userId, projectId, parentId: auditId, url: 'https://example.com/', status: 'CHECKING' } })
    await prisma.improvementAttempt.create({ data: { improvementId: improvement.id, sourceAuditId: auditId, sourceFlagIds: [flag.id],
      builder: 'CUSTOM', verificationAuditId: check.id, createdAt: new Date(Date.now() - 60_000) } })
    await prisma.improvementAttempt.createMany({ data: Array.from({ length: 15 }, () => ({ improvementId: improvement.id,
      sourceAuditId: auditId, sourceFlagIds: [flag.id], builder: 'CUSTOM' })) })
    expect((await ask('Is the page title fixed?')).reply).toContain('FixFlags is checking')
    expect(model).not.toHaveBeenCalled()
  })

  it('distinguishes unavailable recovery proof from a confirmed continued failure', async () => {
    const flag = await capture({ status: 'FIXED', resolvedInId: auditId })
    expect(await loadSiteFlags((await loadSiteRecord(projectId))!)).toMatchObject([{ sourceFlagId: flag.id, verificationState: 'could_not_verify' }])
    const answer = await ask('Is the page title fixed?')
    expect(answer.reply).toContain('could not verify')
    expect(answer.reply).not.toContain('is still open')
    expect(model).not.toHaveBeenCalled()
  })
})
