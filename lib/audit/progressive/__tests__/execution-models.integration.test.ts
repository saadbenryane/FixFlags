import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { loadTaskGraph, persistTaskPlan } from '../engine'

const database = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
const migration = readFileSync('prisma/migrations/20261028230000_separate_execution_tasks/migration.sql', 'utf8')
const ledger = readFileSync('prisma/migrations/20260813160000_judgment_integrity_cycle_ledger/migration.sql', 'utf8')
const foundations = readFileSync('prisma/migrations/20261011010000_execution_foundations/migration.sql', 'utf8')
const progressive = readFileSync('prisma/migrations/20261011040000_progressive_execution/migration.sql', 'utf8')

database('separate task and receipt persistence', () => {
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use the disposable execution verifier')
  })

  it('retains task storage, identity, claims, artifacts, dependencies and receipt custody', async () => {
    const schema = 'upgrade_' + randomUUID().replaceAll('-', '')
    await prisma.$transaction(async tx => {
      // Every unqualified migration statement is confined to this disposable schema.
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}", public`)
      await tx.$executeRawUnsafe('CREATE TABLE audits (id TEXT PRIMARY KEY)')
      // Build the predecessor from its actual immutable migration history.
      const oldStatements = [
        ledger.match(/CREATE TABLE "audit_verifier_executions" \([\s\S]*?\n\);/)![0],
        ...[...ledger.matchAll(/CREATE (?:UNIQUE )?INDEX "audit_verifier_executions_[\s\S]*?;/g)].map(match => match[0]),
        ledger.match(/ALTER TABLE "audit_verifier_executions"[\s\S]*?;/)![0],
        foundations.match(/ALTER TABLE "audit_verifier_executions"[\s\S]*?;/)![0],
        progressive.match(/ALTER TABLE "audit_verifier_executions"[\s\S]*?;/)![0],
        progressive.match(/CREATE INDEX "audit_verifier_executions_[\s\S]*?;/)![0],
      ]
      for (const statement of oldStatements) await tx.$executeRawUnsafe(statement)
      await tx.$executeRaw`INSERT INTO audits (id) VALUES ('source'), ('foreign')`
      const artifact = { kind: 'check', version: 1, data: { flags: [{ evidence: 'Retained observation' }] } }
      await tx.$executeRaw`INSERT INTO audit_verifier_executions
        (id, "auditId", "targetKey", source, status, "workKind", "workState", "workToken", "workGeneration", "workAttempts",
          "workDependencies", "workInput", "workResult", "workLeaseUntil", "workRetryAt", "workRecoveryUntil", "updatedAt")
        VALUES ('task', 'source', 'task:p0:check', 'EXECUTION', 'RUNNING', 'check', 'RUNNING', 'original-token', 7, 3,
          ARRAY['p0:browser'], '{"pageUrl":"https://example.com/"}'::jsonb, ${JSON.stringify(artifact)}::jsonb,
          now() + interval '1 minute', now(), now() + interval '20 minutes', now())`
      await tx.$executeRaw`INSERT INTO audit_verifier_executions
        (id, "auditId", "targetKey", source, status, "evidenceReference", detail, "updatedAt") VALUES
        ('receipt', 'source', 'module:metadata', 'DETERMINISTIC', 'COMPLETED', '{"taskId":"task"}', '{"complete":true}', now()),
        ('foreign-receipt', 'foreign', 'module:metadata', 'DETERMINISTIC', 'COMPLETED', '{"taskId":"task"}', '{"complete":false}', now()),
        ('historical', 'source', 'check:title-missing', 'DETERMINISTIC', 'COMPLETED', NULL, '{"observed":"retained"}', now()),
        ('receipt-reference', 'source', 'module:wrong-task-kind', 'DETERMINISTIC', 'COMPLETED', '{"taskId":"historical"}', '{"complete":false}', now())`
      const [before] = await tx.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM audit_verifier_executions WHERE id = 'task'`
      const [storage] = await tx.$queryRaw<Array<{ id: number }>>`SELECT 'audit_verifier_executions'::regclass::oid::int AS id`
      for (const statement of migration.split(';').map(value => value.trim()).filter(value => value && !['BEGIN', 'COMMIT'].includes(value)))
        await tx.$executeRawUnsafe(statement)
      expect(await tx.$queryRaw`SELECT 'audit_execution_tasks'::regclass::oid::int AS id`).toEqual([storage])
      expect(await tx.$queryRaw`SELECT * FROM audit_execution_tasks WHERE id = 'task'`).toEqual([before])
      expect(await tx.$queryRaw`SELECT id, "taskId", detail FROM audit_verifier_executions ORDER BY id`).toEqual([
        { id: 'foreign-receipt', taskId: null, detail: { complete: false } },
        { id: 'historical', taskId: null, detail: { observed: 'retained' } },
        { id: 'receipt', taskId: 'task', detail: { complete: true } },
        { id: 'receipt-reference', taskId: null, detail: { complete: false } },
      ])
      expect(await tx.$queryRaw`SELECT "recordKind", count(*)::int AS count FROM audit_execution_evidence GROUP BY "recordKind" ORDER BY "recordKind"`)
        .toEqual([{ recordKind: 'receipt', count: 4 }, { recordKind: 'task', count: 1 }])
      await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`)
    }, { timeout: 20_000 })
  })

  it('enforces the source Audit on new task-receipt relationships and composes read-only evidence', async () => {
    const source = await prisma.audit.create({ data: { url: 'https://example.com/' } })
    const foreign = await prisma.audit.create({ data: { url: 'https://other.example/' } })
    try {
      const task = await prisma.auditExecutionTask.create({ data: { auditId: source.id, targetKey: 'task:check',
        source: 'EXECUTION', status: 'RUNNING', workKind: 'check', workState: 'RUNNING' } })
      await expect(prisma.auditVerificationReceipt.create({ data: { auditId: foreign.id, taskId: task.id,
        targetKey: 'module:metadata', source: 'DETERMINISTIC', status: 'COMPLETED' } })).rejects.toMatchObject({ code: 'P2003' })
      const receipt = await prisma.auditVerificationReceipt.create({ data: { auditId: source.id, taskId: task.id,
        targetKey: 'module:metadata', source: 'DETERMINISTIC', status: 'COMPLETED', detail: { complete: true } } })
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: receipt.id } }))
        .toMatchObject({ recordKind: 'receipt', workState: null, workGeneration: null, detail: { complete: true } })
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } }))
        .toMatchObject({ recordKind: 'task', workState: 'RUNNING' })
      await expect(prisma.$executeRaw`UPDATE audit_execution_evidence SET status = 'FAILED' WHERE id = ${task.id}`)
        .rejects.toMatchObject({ code: 'P2010' })
    } finally { await prisma.audit.deleteMany({ where: { id: { in: [source.id, foreign.id] } } }) }
  })
  it('keeps malformed retained tasks visible instead of admitting work over a hidden obligation', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/' } })
    try {
      const task = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:unknown',
        source: 'EXECUTION', status: 'PENDING', workKind: null, workState: 'READY' } })
      expect((await loadTaskGraph(audit.id)).map(row => row.id)).toEqual([task.id])
      await expect(persistTaskPlan(audit.id, [])).rejects.toThrow()
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).toEqual(task)
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })

})
