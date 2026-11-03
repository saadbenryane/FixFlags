import { prisma } from '@/lib/db'
import type { FlagDiffSummaryItem } from '@/lib/audit/flag-types'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagCopyTask } from '@/lib/sites/application/flag-copy-task'

/** Hydrate only exact, owner-scoped findings named by the committed notification.
 * Comparison receipts deliberately contain no repair or private evidence payload. */
export async function loadEmailRepairFindings(projectId: string, userId: string, findings: FlagDiffSummaryItem[]) {
  const ids = findings.slice(0, 8).flatMap(flag => flag.id ? [flag.id] : [])
  if (!ids.length) return findings
  const rows = await prisma.flag.findMany({ where: { id: { in: ids }, audit: {
    projectId, project: { userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
  } }, select: {
    id: true, auditId: true, checkId: true, problem: true, pageUrl: true,
  } })
  const byId = new Map(rows.map(row => [row.id, row]))
  const site = rows.length ? await loadSiteRecord(projectId) : null
  if (rows.length && (!site || site.userId !== userId)) throw new Error('Notification repair scope is no longer owned')
  const tasks = new Map<string, Awaited<ReturnType<typeof loadSiteFlagCopyTask>>>()
  const eligible = rows.filter(row => findings.some(finding => finding.id === row.id && row.checkId === finding.checkId &&
    row.problem === finding.problem && row.pageUrl === (finding.pageUrl ?? null)))
  for (let offset = 0; offset < eligible.length; offset += 4) {
    const prepared = await Promise.all(eligible.slice(offset, offset + 4).map(async row =>
      [row.id, await loadSiteFlagCopyTask(site!, row.id)] as const))
    for (const [id, task] of prepared) tasks.set(id, task)
  }
  const result = []
  for (const finding of findings) {
    const row = finding.id ? byId.get(finding.id) : null
    if (!row || row.checkId !== finding.checkId || row.problem !== finding.problem || row.pageUrl !== (finding.pageUrl ?? null)) { result.push(finding); continue }
    // Exact historical source reference, not a moving incident representative.
    // This is the same authorized projection and revision used by web and MCP.
    const task = tasks.get(row.id)!
    if (task.source.sourceAuditId !== row.auditId || task.source.checkId !== finding.checkId ||
      task.source.problem !== finding.problem || task.source.pageUrl !== (finding.pageUrl ?? null))
      throw new Error('Notification repair source changed during preparation')
    result.push({ ...finding, repairPrompt: task.prompt, repairPromptHash: task.promptHash,
      sourceAuditId: task.source.sourceAuditId })
  }
  return result
}
