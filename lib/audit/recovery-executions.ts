import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { baseCheckId } from './check-identity'
import { CHECK_REGISTRY } from './check-registry'
import { readSupportingObservations } from './flag-observations'
import type { RecoveryExecution, RecoveryFlag } from './recovery-evidence'
import { SEARCH_DEFINITIONS } from './search/definitions'

type RecoverySource = { auditId: string; flags: RecoveryFlag[] }
type RecoveryDatabase = Pick<Prisma.TransactionClient, 'auditVerificationReceipt'>
const SOURCE_BATCH_SIZE = 64
const RECEIPT_BATCH_SIZE = 512

/** Select candidate receipts for every original condition. Exact comparators
 * still decide recovery; unrelated collectors never enter the read. */
export async function loadRecoveryExecutions(sources: RecoverySource[], database: RecoveryDatabase = prisma) {
  const byAudit = new Map<string, Set<string>>()
  for (const source of sources) {
    const ids = new Set(source.flags.flatMap(flag => [flag.checkId,
      ...readSupportingObservations(flag.supportingObservations)?.items.map(item => item.checkId) ?? [],
    ]).flatMap(id => baseCheckId(id) ?? []))
    const targets = byAudit.get(source.auditId) ?? new Set<string>()
    for (const id of ids) {
      targets.add('check:' + id)
      if (Object.hasOwn(CHECK_REGISTRY, id)) targets.add('module:' + CHECK_REGISTRY[id].module)
    }
    for (const definition of SEARCH_DEFINITIONS) if (definition.checkIds.some(id => ids.has(id))) {
      targets.add('module:search'); targets.add('module:search-' + definition.evaluator)
      if (definition.evaluator === 'google') {
        targets.add('module:search-google-index'); targets.add('module:search-google-performance')
      }
    }
    if (targets.size) byAudit.set(source.auditId, targets)
  }
  const sourcesByAudit = [...byAudit]
  const executions = new Map<string, RecoveryExecution[]>()
  // Batch source selection as well as receipt rows. An owner with many historic
  // repairs does not need one query per recovery or an unbounded SQL predicate.
  for (let offset = 0; offset < sourcesByAudit.length; offset += SOURCE_BATCH_SIZE) {
    const selection = sourcesByAudit.slice(offset, offset + SOURCE_BATCH_SIZE).map(([auditId, targets]) => ({ auditId, targetKey: { in: [...targets] } }))
    let afterId: string | undefined
    for (;;) {
      const batch = await database.auditVerificationReceipt.findMany({
        where: { status: 'COMPLETED', OR: selection, ...(afterId ? { id: { gt: afterId } } : {}) },
        select: { id: true, auditId: true, targetKey: true, status: true, pageUrl: true, detail: true,
          task: { select: { id: true, pageUrl: true } } }, orderBy: { id: 'asc' }, take: RECEIPT_BATCH_SIZE,
      })
      for (const row of batch) {
        const rows = executions.get(row.auditId) ?? []
        rows.push(row); executions.set(row.auditId, rows)
      }
      if (batch.length < RECEIPT_BATCH_SIZE) break
      afterId = batch.at(-1)!.id
    }
  }
  return executions
}
