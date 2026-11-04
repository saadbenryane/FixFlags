import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { createImprovementAttempt, recordFlagImprovementAttempt } from './attempts'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagCopyTask } from '@/lib/sites/application/flag-copy-task'
import { claimExecution, withExecutionOwnership } from '@/lib/audit/execution-ownership'

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

  async function retainedRepairHistory() {
    return Promise.all([
      prisma.flag.findMany({ where: { auditId }, orderBy: { id: 'asc' } }),
      prisma.improvement.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
      prisma.improvementOccurrence.findMany({ where: { auditId }, orderBy: { id: 'asc' } }),
      prisma.improvementAttempt.findMany({ where: { improvement: { projectId } }, orderBy: { id: 'asc' } }),
      prisma.improvementCycleEvent.findMany({ where: { cycle: { projectId } }, orderBy: { id: 'asc' } }),
    ])
  }

  it.each((['SUSPENDED', 'DELETING'] as const).flatMap(lifecycleStatus =>
    (['ACCEPT', 'HANDOFF_COPIED', 'READY_TO_VERIFY', 'REJECT'] as const).map(action => ({ lifecycleStatus, action }))))(
    'refuses $action when the account becomes $lifecycleStatus after its source read', async ({ lifecycleStatus, action }) => {
      const before = await retainedRepairHistory(), read = prisma.flag.findFirst.bind(prisma.flag)
      let changed = false
      const source = vi.spyOn(prisma.flag, 'findFirst').mockImplementationOnce(async args => {
        const flag = await read(args)
        await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus } })
        changed = true
        return flag
      })
      try {
        await expect(recordFlagImprovementAttempt({ flagId, userId: owner, builder: 'late-account-action', action,
          rejectionReason: 'POOR_TIMING', idempotencyKey: 'late-account-action:' + lifecycleStatus }))
          .rejects.toMatchObject({ status: 403, code: 'ACCOUNT_UNAVAILABLE' })
        expect(changed).toBe(true)
        expect(await retainedRepairHistory()).toEqual(before)
      } finally {
        source.mockRestore()
        await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus: 'ACTIVE' } })
      }
    })

  it.each(['SUSPENDED', 'DELETING'] as const)('refuses a fix declaration when the account becomes %s after identity preparation', async lifecycleStatus => {
    await recordFlagImprovementAttempt({ flagId, userId: owner, builder: 'prepared-identity', action: 'HANDOFF_COPIED' })
    const identity = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId } })
    const before = await retainedRepairHistory(), read = prisma.improvement.findFirst.bind(prisma.improvement)
    let changed = false
    const source = vi.spyOn(prisma.improvement, 'findFirst').mockImplementationOnce(async args => {
      const improvement = await read(args)
      await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus } })
      changed = true
      return improvement
    })
    try {
      await expect(createImprovementAttempt({ improvementId: identity.improvementId, projectId, userId: owner,
        sourceAuditId: auditId, builder: 'late-fix', handoffReference: 'flag:' + flagId, idempotencyKey: 'late-fix:' + lifecycleStatus }))
        .rejects.toMatchObject({ status: 403, code: 'ACCOUNT_UNAVAILABLE' })
      expect(changed).toBe(true)
      expect(await retainedRepairHistory()).toEqual(before)
    } finally {
      source.mockRestore()
      await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus: 'ACTIVE' } })
    }
  })

  it.each(['handoff', 'declaration'] as const)('settles a concurrent account suspension before a %s and resumes the original history after restoration', async stage => {
    await recordFlagImprovementAttempt({ flagId, userId: owner, builder: 'account-lock-fixture', action: 'HANDOFF_COPIED' })
    const identity = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId } })
    const before = await retainedRepairHistory()
    let release!: () => void, announce!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const acquired = new Promise<void>(resolve => { announce = resolve })
    const suspension = prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: owner }, data: { lifecycleStatus: 'SUSPENDED' } })
      announce()
      await held
    }, { timeout: 10_000 })
    const declare = () => stage === 'handoff'
      ? recordFlagImprovementAttempt({ flagId, userId: owner, builder: 'after-suspension', action: 'HANDOFF_COPIED' })
      : createImprovementAttempt({ improvementId: identity.improvementId, projectId, userId: owner, sourceAuditId: auditId,
        builder: 'after-suspension', handoffReference: 'flag:' + flagId, idempotencyKey: 'after-suspension' })
    let pending: Promise<unknown> | undefined
    try {
      await acquired
      pending = declare().then(result => ({ result }), error => ({ status: error.status, code: error.code }))
      await expect.poll(async () => {
        const waiting = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
            AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'
            AND query LIKE '%FROM "users"%FOR UPDATE%') AS waiting`
        return waiting[0].waiting
      }, { timeout: 3_000 }).toBe(true)
      release()
      await suspension
      expect(await pending).toEqual({ status: 403, code: 'ACCOUNT_UNAVAILABLE' })
      expect(await retainedRepairHistory()).toEqual(before)
    } finally {
      release()
      await suspension
      await pending
      await prisma.user.update({ where: { id: owner }, data: { lifecycleStatus: 'ACTIVE' } })
    }
    await declare()
    const restored = await retainedRepairHistory()
    await declare()
    expect(await retainedRepairHistory()).toEqual(restored)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toEqual(before[0].find(flag => flag.id === flagId))
  })

  it('locks the active actor before inherited worker Site and Audit authority', async () => {
    await recordFlagImprovementAttempt({ flagId, userId: owner, builder: 'worker-order-fixture', action: 'HANDOFF_COPIED' })
    const identity = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId } })
    const execution = await claimExecution(auditId, { projectionOnly: true })
    expect(execution).not.toBeNull()
    const original = prisma.$transaction.bind(prisma)
    let statements: string[] = []
    const transaction = vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (...[operation, options]: Parameters<typeof original>) => {
      if (typeof operation !== 'function') throw new Error('Expected a command transaction')
      return original(async tx => {
        const read = vi.fn(tx.$queryRaw.bind(tx))
        const observed = new Proxy(tx, { get(target, key, receiver) { return key === '$queryRaw' ? read : Reflect.get(target, key, receiver) } })
        try { return await operation(observed) }
        finally { statements = read.mock.calls.map(([query]) => 'sql' in query ? query.sql : Array.from(query).join('')) }
      }, options)
    }) as typeof original)
    try {
      const attempt = await withExecutionOwnership(execution!, () => createImprovementAttempt({ improvementId: identity.improvementId,
        projectId, userId: owner, sourceAuditId: auditId, builder: 'worker-order', handoffReference: 'flag:' + flagId,
        idempotencyKey: 'worker-order' }))
      expect(attempt).toMatchObject({ improvementId: identity.improvementId, sourceAuditId: auditId })
      expect(statements[0]).toContain('FROM "users"')
      expect(statements[0]).toContain('FOR UPDATE')
      expect(statements.slice(1).some(sql => sql.includes('"projects"') && sql.includes('FOR SHARE'))).toBe(true)
      expect(statements.slice(1).some(sql => sql.includes('"audits"') && sql.includes('FOR UPDATE'))).toBe(true)
    } finally {
      transaction.mockRestore()
      await prisma.audit.update({ where: { id: auditId }, data: { executionToken: null, executionLeaseUntil: null } })
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
  it('records the canonical recipe for a source with no saved fix and refuses its changed revision at the write boundary', async () => {
    const source = await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', checkId: 'unoptimized-images',
      rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'Images are not optimized', evidence: 'hero.jpg can save 2MB',
      whyItMatters: 'Large downloads can delay the page.', fix: '', pageUrl: 'https://handoff.test/', confidence: 1, position: 1 } })
    const site = await loadSiteRecord(projectId)
    expect(site?.userId).toBe(owner)
    const task = await loadSiteFlagCopyTask(site!, source.id)
    expect(task.prompt).toContain('size it is displayed')
    const command = { type: 'RECORD_FIX_HANDOFF' as const, flagId: source.id, userId: owner, builder: 'copy', client: 'website-clipboard-v2',
      preparedHandoff: { siteId: projectId, referenceFlagId: source.id, promptHash: task.promptHash, context: task.revision } }
    await executeSiteCommand(command)
    await executeSiteCommand(command)
    const receipt = await prisma.improvementCycleEvent.findMany({ where: { cycle: { projectId, sourceAuditId: auditId },
      type: 'HANDOFF_COPIED', idempotencyKey: { contains: task.promptHash } } })
    expect(receipt).toHaveLength(1)
    expect(receipt[0].contextCorrection).toMatchObject({ schemaVersion: 'fixflags.handoff-receipt.v1', promptHash: task.promptHash,
      sourceFlagId: source.id, context: { contextHash: task.revision.contextHash, sourceFlagIds: [source.id], kind: 'repair' } })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ fix: '' })
    await prisma.flag.update({ where: { id: source.id }, data: { evidence: 'A different image and measurement' } })
    await expect(executeSiteCommand(command)).rejects.toMatchObject({ status: 409, code: 'REPAIR_TASK_CHANGED' })
    expect(await prisma.improvementCycleEvent.findMany({ where: { id: receipt[0].id } })).toEqual(receipt)
  })

})
