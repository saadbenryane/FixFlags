import { z } from 'zod'

export const PUBLIC_LINK_LIMITATION = 'Public link GET responses cover the recorded destination inventory. Access restrictions, transport failures, untested links and interactive behavior remain unknown.'

const publicLinkCoverageSchema = z.object({
  kind: z.literal('site-module-check'), version: z.literal(1), module: z.literal('seo'),
  pageUrl: z.string(), applicable: z.literal(true), complete: z.boolean(), failed: z.boolean().nullish(), limitation: z.string().nullish(),
  publicLinkInventoryComplete: z.boolean().nullish(),
  execution: z.object({ auditId: z.string().min(1), checkVersion: z.number().int().positive(), source: z.literal('http') }),
  assertions: z.array(z.object({ key: z.literal('public-destination'), complete: z.boolean(),
    context: z.string().regex(/^destination:[a-f0-9]{64}$/).nullish(), disposition: z.literal('observed').nullish() })).max(120),
})

type CoverageRow = { targetKey: string; status?: string | null; scopeKey?: string | null; pageUrl?: string | null; auditId?: string; detail?: unknown }

/** A second pass can supply missing response facts. Inventory omissions and
 * unavailable captures require their own evidence. Stored receipts are immutable. */
export function resolvedPublicLinkCoverageGaps<T extends CoverageRow>(rows: readonly T[], auditId?: string): Set<T> {
  const retried = new Set<string>()
  const firstPass: Array<{ row: T; contexts: string[] }> = []
  for (const row of rows) {
    if (row.targetKey !== 'module:seo' || row.status !== 'COMPLETED' || !row.pageUrl) continue
    const prefix = 'page:' + row.pageUrl + ':public-links:'
    if (!row.scopeKey?.startsWith(prefix)) continue
    const phase = /^(first|second)(?::batch:\d+)?$/.exec(row.scopeKey.slice(prefix.length))?.[1]
    if (!phase) continue
    const parsed = publicLinkCoverageSchema.safeParse(row.detail)
    if (!parsed.success) continue
    const receipt = parsed.data
    const source = receipt.execution
    if (receipt.failed || receipt.pageUrl !== row.pageUrl || auditId !== undefined && auditId !== source.auditId ||
      row.auditId !== undefined && row.auditId !== source.auditId) continue
    const key = (context: string) => JSON.stringify([source.auditId, receipt.pageUrl, source.checkVersion, context])
    if (phase === 'second') {
      for (const assertion of receipt.assertions) if (assertion.complete && assertion.context && !assertion.disposition) retried.add(key(assertion.context))
    } else if (!receipt.complete && (receipt.publicLinkInventoryComplete ?? receipt.limitation === PUBLIC_LINK_LIMITATION)) {
      const missing = receipt.assertions.filter(assertion => !assertion.complete)
      const contexts = missing.flatMap(assertion => assertion.context && !assertion.disposition ? [key(assertion.context)] : [])
      if (missing.length && contexts.length === missing.length) firstPass.push({ row, contexts })
    }
  }
  return new Set(firstPass.filter(entry => entry.contexts.every(context => retried.has(context))).map(entry => entry.row))
}
