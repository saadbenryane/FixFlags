import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { executeSiteCommand } from '@/lib/sites/application/commands'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('retained clipboard handoff provenance in PostgreSQL', () => {
  const owner = 'clipboard-custody-' + randomUUID()
  let projectId: string
  let auditId: string
  let flagId: string
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use the disposable execution verifier')
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    const project = await prisma.project.create({ data: { userId: owner, canonicalHost: 'handoff.test',
      url: 'https://handoff.test/', name: 'Controlled handoff custody fixture', watchInterval: null } })
    projectId = project.id
    const audit = await prisma.audit.create({ data: { userId: owner, projectId,
      url: project.url, status: 'COMPLETED', completedAt: new Date(), isPublic: false } })
    auditId = audit.id
    const flag = await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', checkId: 'buttons-no-text',
      rubric: 'TRUST', severity: 'IMPORTANT', problem: 'The controlled search button has no accessible name.',
      evidence: 'The recorded search button has no text or accessible name.', whyItMatters: 'Its purpose is unavailable by name.',
      fix: 'Add the visible label Search to the recorded search button.', confidence: 1, position: 0 } })
    flagId = flag.id
  })
  afterAll(async () => {
    await prisma.siteLifecycleEvent.deleteMany({ where: { idempotencyKey: { startsWith: `fix-handoff:${owner}:` } } })
    if (auditId) await prisma.audit.deleteMany({ where: { id: auditId } })
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: owner } })
    await prisma.$disconnect()
  })

  it('preserves the earlier unconfirmed record when a new clipboard acknowledgement is retried', async () => {
    const input = { type: 'RECORD_FIX_HANDOFF' as const, flagId, userId: owner, builder: 'copy' }
    const originalFlag = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    await executeSiteCommand(input)
    const legacy = await prisma.improvementCycleEvent.findFirstOrThrow({
      where: { cycle: { projectId }, type: 'HANDOFF_COPIED' },
    })
    expect(legacy.client).toBeNull()
    const legacyLifecycle = await prisma.siteLifecycleEvent.findUniqueOrThrow({
      where: { idempotencyKey: `fix-handoff:${owner}:${flagId}:copy` },
    })
    for (let repeat = 0; repeat < 2; repeat++)
      await executeSiteCommand({ ...input, client: 'website-clipboard-v2' })
    const events = await prisma.improvementCycleEvent.findMany({
      where: { cycle: { projectId }, type: 'HANDOFF_COPIED' }, orderBy: { occurredAt: 'asc' },
    })
    expect(events).toHaveLength(2)
    expect(events.find(event => event.id === legacy.id)).toEqual(legacy)
    expect(events.find(event => event.id !== legacy.id)).toMatchObject({ client: 'website-clipboard-v2',
      type: 'HANDOFF_COPIED', transport: 'copy' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toEqual(originalFlag)
    const lifecycle = await prisma.siteLifecycleEvent.findMany({ where: { userId: owner, name: 'fix_handoff' } })
    expect(lifecycle).toHaveLength(2)
    expect(lifecycle.find(event => event.id === legacyLifecycle.id)).toEqual(legacyLifecycle)
    expect(lifecycle.find(event => event.id !== legacyLifecycle.id)?.properties).toMatchObject({ client: 'website-clipboard-v2' })
    expect(await prisma.improvementAttempt.count({ where: { improvement: { projectId } } })).toBe(0)
    expect(await prisma.improvement.findFirstOrThrow({ where: { projectId } })).toMatchObject({ status: 'PROPOSED', acceptedAt: null })
  })
})
