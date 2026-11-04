import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadUptimeSummary } from '@/lib/uptime/queries'
import { uptimeAssessment } from '@/lib/uptime/status'
import { getSiteAgentHistory, sendSiteAgentMessage } from '../agent'

const model = vi.hoisted(() => vi.fn())
vi.mock('@/lib/workspace/chat', async original => ({ ...await original<typeof import('@/lib/workspace/chat')>(), runWorkspaceChat: model }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Site agent uptime attention', () => {
  let userId: string, projectId: string, monitorId: string
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = (await prisma.user.create({ data: { email: randomUUID() + '@agent-uptime.example' } })).id
    projectId = (await prisma.project.create({ data: { userId, canonicalHost: 'example.com', url: 'https://example.com/',
      name: 'Uptime evidence', watchInterval: 'WEEKLY' } })).id
    monitorId = (await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: 'https://example.com/', state: 'offline',
      lastCheckedAt: new Date(), nextProbeAt: new Date(Date.now() + 300_000) } })).id
    await prisma.uptimeIncident.create({ data: { monitorId, version: 1, targetUrl: 'https://example.com/',
      startedAt: new Date(Date.now() - 60_000), confirmedAt: new Date(Date.now() - 30_000), reason: 'response_error' } })
    model.mockReset().mockRejectedValue(new Error('External chat calls are disabled in this local fixture'))
  })
  afterEach(async () => { vi.restoreAllMocks(); await prisma.user.deleteMany({ where: { id: userId } }) })
  const ask = (message: string) => sendSiteAgentMessage({ siteId: projectId, userId, requestKey: randomUUID(), message })

  it.each(['What needs attention?', 'What should I do next?', "What's unresolved?"])(
    'answers the default monitoring question without a model or audit Flag: %s', async message => {
      const site = (await loadSiteRecord(projectId))!
      expect(uptimeAssessment(await loadUptimeSummary(site), new Date())?.state).toBe('FLAG')
      vi.spyOn(prisma.uptimeProbe, 'findMany').mockRejectedValue(new Error('Attention must not load probe history'))
      const answer = await ask(message)
      expect(answer.reply).toContain('offline')
      expect(answer.reply).not.toContain('nothing to fix')
      expect(model).not.toHaveBeenCalled()
      expect(answer.citations).toEqual([expect.objectContaining({ type: 'watch', id: projectId,
        href: `/sites/${projectId}?category=uptime#category-uptime` })])
      expect(await prisma.flag.count({ where: { audit: { projectId } } })).toBe(0)
    })

  it('retains an unresolved incident when current reachability is no longer known', async () => {
    await prisma.uptimeMonitor.update({ where: { id: monitorId }, data: { lastCheckedAt: new Date(Date.now() - 3600_000) } })
    expect(uptimeAssessment(await loadUptimeSummary((await loadSiteRecord(projectId))!), new Date()))
      .toMatchObject({ state: 'FLAG', observedState: 'unknown' })
    const answer = await ask("What's unresolved?")
    expect(answer.reply).toContain('unresolved uptime incident')
    expect(answer.reply).not.toContain('No unresolved')
    expect(model).not.toHaveBeenCalled()
  })

  it.each(['missing', 'stale', 'retargeted', 'checking', 'paused', 'online'] as const)(
    'keeps %s availability distinct from an outage or whole-Site success', async state => {
      await prisma.uptimeIncident.updateMany({ where: { monitorId }, data: { recoveredAt: new Date() } })
      await prisma.uptimeMonitor.update({ where: { id: monitorId }, data: {
        state: state === 'checking' ? 'checking' : 'online',
        lastCheckedAt: state === 'missing' ? null : new Date(Date.now() - (state === 'stale' ? 3600_000 : 0)),
      } })
      if (state === 'retargeted') await prisma.project.update({ where: { id: projectId }, data: { url: 'https://example.com/new-target' } })
      if (state === 'paused') await prisma.project.update({ where: { id: projectId }, data: { watchPausedAt: new Date() } })
      const answer = await ask('Is my website online?')
      expect(answer.reply).toContain(state === 'online' ? 'found your website online' : state === 'paused' ? 'paused'
        : state === 'checking' ? 'has not been confirmed' : 'currently unknown')
      expect(model).not.toHaveBeenCalled()
      if (state === 'online') expect((await ask('What should I do next?')).reply).not.toContain('nothing to fix')
    })

  it('puts a current outage before independent audit repairs without hiding those findings', async () => {
    const audit = await prisma.audit.create({ data: { userId, projectId, url: 'https://example.com/', status: 'COMPLETED', completedAt: new Date() } })
    const flag = await prisma.flag.create({ data: { auditId: audit.id, checkId: 'title-missing', source: 'DETERMINISTIC', rubric: 'REACH',
      severity: 'CRITICAL', problem: 'Page title is missing', evidence: 'The captured title is empty.',
      whyItMatters: 'The page is difficult to identify.', fix: 'Add a descriptive title.', confidence: 1, position: 0 } })
    const answer = await ask('What should I do next?')
    expect(answer.reply.indexOf('offline')).toBeGreaterThanOrEqual(0)
    expect(answer.reply.indexOf('offline')).toBeLessThan(answer.reply.indexOf(flag.problem))
    expect(answer.citations[0]).toMatchObject({ type: 'watch', id: projectId })
    expect(answer.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'flag', id: flag.id }), expect.objectContaining({ type: 'watch', id: projectId }),
    ]))
    expect(model).not.toHaveBeenCalled()
  })

  it('rebuilds the owning uptime destination and refuses foreign references in stored conversation history', async () => {
    const answer = await ask('What needs attention?')
    await prisma.siteAgentMessage.update({ where: { id: answer.messageId }, data: { citations: [
      { type: 'watch', id: projectId, label: 'Uptime evidence', href: '/sites/foreign?category=uptime' },
      { type: 'watch', id: 'foreign', label: 'Other evidence', href: `/sites/${projectId}?category=uptime` },
    ] } })
    const history = await getSiteAgentHistory({ siteId: projectId, userId })
    expect(history.messages.find(message => message.id === answer.messageId)?.citations).toEqual([
      { type: 'watch', id: projectId, label: 'Uptime evidence', href: `/sites/${projectId}?category=uptime#category-uptime` },
    ])
  })
})
