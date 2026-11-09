import { Prisma } from '@prisma/client'
import { AGENT_PROMPT_KEYS } from '@/lib/audit/flag-types'
import { repairGuidanceState } from '@/lib/improvements/repair-guidance'
import { ADMIN_PAGE_SIZE } from './list-query'

type Reader = Pick<Prisma.TransactionClient, '$queryRaw'>
type GuidanceGap = { id: string; siteId: string; auditId: string; label: string; at: Date }
type Candidate = GuidanceGap & Omit<Parameters<typeof repairGuidanceState>[0], 'evidence' | 'evidenceMissing'> & { hasEvidence: boolean }
const BATCH_SIZE = 50
// Match String.trim() even for legacy Flags stored with Unicode whitespace.
const trimCharacters = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'
const promptColumns = Prisma.join(AGENT_PROMPT_KEYS.map(field => Prisma.raw(`f."${field}"`)))

/** A recorded problem always allows a local definition, including an evidence
 * recovery instruction. Inspect only legacy candidates missing that input. */
async function* guidanceGaps(db: Reader): AsyncGenerator<GuidanceGap> {
  let after: Pick<GuidanceGap, 'at' | 'id'> | undefined
  for (;;) {
    const batch: Candidate[] = await db.$queryRaw<Candidate[]>(Prisma.sql`
      SELECT f.id, p.id AS "siteId", a.id AS "auditId", a.url AS label, f."createdAt" AS at,
        f.problem, f.fix, f."checkId", f."attentionPolicy", f."supportingObservations",
        btrim(f.evidence, ${trimCharacters}) <> '' AS "hasEvidence", ${promptColumns},
        jsonb_build_object('includeAi', a."includeAi", 'triageAt', a."triageAt", 'aiReviewAt', a."aiReviewAt", 'failureCode', a."failureCode") AS audit
      FROM flags f JOIN audits a ON a.id = f."auditId"
      JOIN projects p ON p.id = a."projectId" JOIN users u ON u.id = p."userId"
      WHERE a.status = 'COMPLETED' AND p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE'
        AND f.status NOT IN ('FIXED', 'IGNORED') AND btrim(f.problem, ${trimCharacters}) = ''
        ${after ? Prisma.sql`AND (f."createdAt", f.id) < (${after.at}, ${after.id})` : Prisma.empty}
      ORDER BY f."createdAt" DESC, f.id DESC LIMIT ${BATCH_SIZE}`)
    for (const { id, siteId, auditId, label, at, hasEvidence, ...guidance } of batch) {
      // Pass evidence presence through the existing gate without reading its text.
      if (repairGuidanceState({ ...guidance, evidenceMissing: !hasEvidence }) === 'unavailable')
        yield { id, siteId, auditId, label, at }
    }
    if (batch.length < BATCH_SIZE) return
    after = batch.at(-1)!
  }
}

/** The calling admin read authorizes inspection. Keep just the requested
 * page and the final page, so out-of-range requests can still be clamped. */
export async function readGuidanceGaps(db: Reader, requestedPage?: number) {
  let total = 0
  const requested: GuidanceGap[] = []
  let last: GuidanceGap[] = []
  for await (const gap of guidanceGaps(db)) {
    if (requestedPage !== undefined) {
      if (total % ADMIN_PAGE_SIZE === 0) last = []
      last.push(gap)
      if (Math.floor(total / ADMIN_PAGE_SIZE) + 1 === requestedPage) requested.push(gap)
    }
    total++
  }
  return { total, rows: requested.length ? requested : last }
}

export async function countGuidanceGaps(db: Reader): Promise<number> {
  return (await readGuidanceGaps(db)).total
}
