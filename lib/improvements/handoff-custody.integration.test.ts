import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { recordFlagImprovementAttempt } from './attempts'

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

  it('refuses an already-linked handoff after Site ownership changes or removal', async () => {
    const nextOwner = 'next-clipboard-owner-' + randomUUID()
    const events = await prisma.improvementCycleEvent.count({ where: { cycle: { projectId } } })
    await prisma.user.create({ data: { id: nextOwner, email: nextOwner + '@example.test' } })
    try {
      await prisma.project.update({ where: { id: projectId }, data: { userId: nextOwner } })
      await expect(executeSiteCommand({ type: 'RECORD_FIX_HANDOFF', flagId, userId: owner, builder: 'copy' }))
        .rejects.toThrow('Flag is not attached to an owned Product')
      await prisma.project.update({ where: { id: projectId }, data: { userId: owner, deletedAt: new Date() } })
      await expect(executeSiteCommand({ type: 'RECORD_FIX_HANDOFF', flagId, userId: owner, builder: 'copy' }))
        .rejects.toThrow('Flag is not attached to an owned Product')
      expect(await prisma.improvementCycleEvent.count({ where: { cycle: { projectId } } })).toBe(events)
    } finally {
      await prisma.project.update({ where: { id: projectId }, data: { userId: owner, deletedAt: null } })
      await prisma.user.delete({ where: { id: nextOwner } })
    }
  })

  it('settles a concurrent ownership transfer before recording a linked handoff', async () => {
    const nextOwner = 'concurrent-clipboard-owner-' + randomUUID()
    await prisma.user.create({ data: { id: nextOwner, email: nextOwner + '@example.test' } })
    const before = await prisma.improvementCycleEvent.findMany({ where: { cycle: { projectId } }, orderBy: { id: 'asc' } })
    let release = () => {}
    let announce = () => {}
    const held = new Promise<void>(resolve => { release = resolve })
    const acquired = new Promise<void>(resolve => { announce = resolve })
    const transfer = prisma.$transaction(async tx => {
      await tx.project.update({ where: { id: projectId }, data: { userId: nextOwner } })
      announce()
      await held
    }, { timeout: 10_000 })
    let command: Promise<unknown> | undefined
    try {
      await acquired
      // A normal read still sees the old owner while the transfer is uncommitted.
      command = recordFlagImprovementAttempt({ flagId, userId: owner, builder: 'stale-copy', action: 'HANDOFF_COPIED' })
        .then(result => ({ result }), error => ({ error: error.message }))
      await expect.poll(async () => {
        const waiting = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
            AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'
            AND query LIKE '%SELECT "id" FROM "projects"%FOR UPDATE%') AS waiting`
        return waiting[0].waiting
      }, { timeout: 3_000 }).toBe(true)
      release()
      await transfer
      expect(await command).toEqual({ error: 'Flag is not attached to an owned Product' })
      expect(await prisma.improvementCycleEvent.findMany({ where: { cycle: { projectId } }, orderBy: { id: 'asc' } })).toEqual(before)
    } finally {
      release()
      await transfer
      await command
      await prisma.project.update({ where: { id: projectId }, data: { userId: owner } })
      await prisma.user.delete({ where: { id: nextOwner } })
    }
  })
})
