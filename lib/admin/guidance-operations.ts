import { Prisma } from '@prisma/client'
import {
  CONDITIONAL_INSPECTION_CONDITION, CONDITIONAL_INSPECTION_START,
  CONTEXTUAL_REVIEW_CHECK_IDS, LEGACY_LOCKED_PROMPT_TEXT,
} from '@/lib/audit/prescription-policy'
import { AGENT_PROMPT_KEYS } from '@/lib/audit/flag-types'
import { HISTORICAL_INDEXING_DECLARATIONS, searchAttentionDecision } from '@/lib/audit/search/policy'

type Reader = Pick<Prisma.TransactionClient, '$queryRaw'>
// ECMAScript trim characters also cover historical whitespace-only prompts.
const trimCharacters = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'
const candidate = Prisma.sql`btrim(g.value, ${trimCharacters})`
const folded = Prisma.sql`translate(${candidate}, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')`
const boundary = '(?:(?<=[A-Za-z0-9_])(?![A-Za-z0-9_])|(?<![A-Za-z0-9_])(?=[A-Za-z0-9_]))'
// Match JavaScript whitespace, digits, ASCII case folding and word boundaries.
const sqlPattern = (pattern: RegExp) => pattern.source.replaceAll('\\s', `[${trimCharacters}]`)
  .replaceAll('\\d', '[0-9]').replaceAll('\\b', boundary)
const start = sqlPattern(CONDITIONAL_INSPECTION_START), condition = sqlPattern(CONDITIONAL_INSPECTION_CONDITION)
// Identifiers come only from the canonical typed Flag prompt fields.
const candidates = Prisma.join([...AGENT_PROMPT_KEYS, 'fix'].map(field => Prisma.sql`(${Prisma.raw(`f."${field}"`)})`))
const scope = Prisma.sql`FROM flags f JOIN audits a ON a.id = f."auditId"
  JOIN projects p ON p.id = a."projectId" JOIN users u ON u.id = p."userId"
  WHERE a.status = 'COMPLETED' AND p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE'
    AND f.status NOT IN ('FIXED', 'IGNORED') AND NOT EXISTS (
      SELECT 1 FROM (VALUES ${candidates}) AS g(value)
      WHERE ${candidate} <> '' AND ${candidate} NOT IN (${Prisma.join([...LEGACY_LOCKED_PROMPT_TEXT])}) AND (
        coalesce(split_part(f."checkId", '::page:', 1), '') NOT IN (${Prisma.join([...CONTEXTUAL_REVIEW_CHECK_IDS])})
        OR (${folded} ~ ${start} AND ${folded} ~ ${condition})
      )
    )`

async function guidanceScope(db: Reader) {
  const possible = await db.$queryRaw<Array<{ id: string; checkId: string | null; attentionPolicy: unknown }>>(
    Prisma.sql`SELECT f.id, f."checkId", f."attentionPolicy" ${scope} AND (
      split_part(f."checkId", '::page:', 1) IN (${Prisma.join([...HISTORICAL_INDEXING_DECLARATIONS])})
      OR f."attentionPolicy"->>'reason' = 'historical_intent_not_established'
    )`,
  )
  // The canonical parser decides historical policy, including invalid metadata.
  // No customer task or evidence text leaves the database for this inspection.
  const available = possible.filter(flag => searchAttentionDecision(flag)?.reason === 'historical_intent_not_established').map(flag => flag.id)
  return available.length ? Prisma.sql`${scope} AND NOT (f.id = ANY(${available}::text[]))` : scope
}

/** Metadata only. The caller must enforce operator access before either query. */
export async function countGuidanceGaps(db: Reader): Promise<number> {
  const selected = await guidanceScope(db)
  const [row] = await db.$queryRaw<Array<{ count: number }>>(Prisma.sql`SELECT count(*)::integer AS count ${selected}`)
  return row.count
}

export async function guidanceGapRows(db: Reader, pagination: { skip: number; take: number }) {
  const selected = await guidanceScope(db)
  return db.$queryRaw<Array<{ id: string; siteId: string; auditId: string; label: string; at: Date }>>(
    Prisma.sql`SELECT f.id, p.id AS "siteId", a.id AS "auditId", a.url AS label, f."createdAt" AS at ${selected}
      ORDER BY f."createdAt" DESC, f.id DESC LIMIT ${pagination.take} OFFSET ${pagination.skip}`,
  )
}
