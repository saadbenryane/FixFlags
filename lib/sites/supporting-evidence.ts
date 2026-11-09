import { createHash } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { publicSupportingObservations, readSupportingObservations, type SupportingObservationView } from '@/lib/audit/flag-observations'
import { parseEvidenceTargets } from '@/lib/audit/evidence-targets'
import { canonicalIntent } from './domain/execution-spec'
import { SiteRunRefusal } from './application/run-refusal'
import type { SiteRecord } from './types'

const indexSchema = z.object({ version: z.literal(1), sourceVersion: z.number().int().nonnegative(),
  kind: z.enum(['absent', 'recorded', 'invalid']), count: z.number().int().min(0).max(5000),
  digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict()
type ObservationIndex = z.infer<typeof indexSchema>
export type SupportingEvidenceSource = {
  id: string; auditId: string; source?: string | null; checkId: string | null; pageUrl: string | null;
  evidence: string; evidenceTargets?: unknown; supportingObservations?: unknown;
  supportingObservationVersion?: number; supportingObservationIndex?: unknown;
}
export type SupportingEvidencePage = { offset: number; total: number | null; observations: SupportingObservationView[] | null; revision: string }
const digest = (value: unknown) => createHash('sha256').update(canonicalIntent(value)).digest('hex')

function recordedIndex(sourceVersion: number, value: unknown): ObservationIndex {
  if (value == null) return { version: 1, sourceVersion, kind: 'absent', count: 0, digest: digest([]) }
  const recorded = readSupportingObservations(value)
  return { version: 1, sourceVersion, kind: recorded ? 'recorded' : 'invalid',
    count: recorded?.items.length ?? 0, digest: digest(recorded ? publicSupportingObservations(recorded) : null) }
}
function retainedIndex(source: SupportingEvidenceSource) {
  const indexed = indexSchema.safeParse(source.supportingObservationIndex)
  return indexed.success && indexed.data.sourceVersion === source.supportingObservationVersion ? indexed.data : null
}
function historicalObservation(source: SupportingEvidenceSource): SupportingObservationView {
  return { source: source.source ?? null, checkId: source.checkId, checkVersion: null, pageUrl: source.pageUrl,
    evidence: source.evidence, recordedAt: null,
    references: parseEvidenceTargets(source.evidenceTargets).map(({ device, label, selector }) => ({ device, label, selector })) }
}
function presentedIndex(source: SupportingEvidenceSource, index: ObservationIndex, grouped: boolean) {
  return grouped && index.kind === 'absent' ? { ...index, count: 1, digest: digest([historicalObservation(source)]) } : index
}
function sourceRevision(sources: SupportingEvidenceSource[], indexes: ObservationIndex[], grouped: boolean) {
  return digest({ version: 1, grouped, sources: sources.map((source, position) => ({
    id: source.id, auditId: source.auditId, ...presentedIndex(source, indexes[position], grouped),
  })) })
}

/** Full reads and bounded reads share one revision owner. No observation
 * payload is duplicated in the index. Historical unknowns remain unknown. */
export function supportingEvidenceRevision(sources: SupportingEvidenceSource[], grouped: boolean) {
  return sourceRevision(sources, sources.map(source => retainedIndex(source)
    ?? recordedIndex(source.supportingObservationVersion ?? 0, source.supportingObservations)), grouped)
}

async function changed(site: SiteRecord): Promise<never> {
  const owner = site.projectId && site.userId && await prisma.project.findFirst({ where: {
    id: site.projectId, userId: site.userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' },
  }, select: { id: true } })
  if (!owner) throw new SiteRunRefusal('Site not found', 404)
  throw new SiteRunRefusal('Finding evidence changed. Refresh this repair task.', 409, 'REPAIR_CONTEXT_CHANGED')
}
async function ensureIndex(site: SiteRecord, source: SupportingEvidenceSource) {
  const retained = retainedIndex(source)
  if (retained) return retained
  const row = await prisma.flag.findFirst({ where: { id: source.id, auditId: source.auditId,
    supportingObservationVersion: source.supportingObservationVersion ?? 0,
    audit: { projectId: site.projectId, project: { userId: site.userId!, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } },
  }, select: { supportingObservations: true, supportingObservationVersion: true } })
  if (!row) return changed(site)
  const index = recordedIndex(row.supportingObservationVersion, row.supportingObservations)
  const saved = await prisma.flag.updateMany({ where: { id: source.id, auditId: source.auditId,
    supportingObservationVersion: row.supportingObservationVersion,
    audit: { projectId: site.projectId, project: { userId: site.userId!, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } },
  }, data: { supportingObservationIndex: index } })
  if (saved.count !== 1) return changed(site)
  return index
}

/** Load only the requested native JSON window. Version predicates fence every
 * window and index publication, including updates by older clients. */
export async function readSupportingEvidencePage(site: SiteRecord, sources: SupportingEvidenceSource[], grouped: boolean,
  offset: number, limit: number): Promise<SupportingEvidencePage> {
  if (!site.projectId || !site.userId) throw new SiteRunRefusal('Site not found', 404)
  if (!Number.isInteger(offset) || offset < 0 || offset > 5000 || !Number.isInteger(limit) || limit < 1 || limit > 25)
    throw new SiteRunRefusal('Choose a valid supporting observation page.', 400, 'INVALID_OBSERVATION_PAGE')
  const indexes = []
  for (const source of sources) indexes.push(await ensureIndex(site, source))
  const presented = indexes.map((index, position) => presentedIndex(sources[position], index, grouped))
  const count = presented.reduce((sum, index) => sum + index.count, 0)
  const total = indexes.some(index => index.kind === 'invalid') || count > 5000 ? null : count
  const revision = sourceRevision(sources, indexes, grouped)
  if (offset > (total ?? 0)) throw new SiteRunRefusal('Choose a valid supporting observation page.', 400, 'INVALID_OBSERVATION_PAGE')
  const observations: SupportingObservationView[] = []
  let preceding = 0
  for (let position = 0; position < sources.length; position++) {
    const source = sources[position], index = presented[position]
    const start = Math.max(0, offset - preceding), take = total === null ? 0 : Math.min(index.count - start, limit - observations.length)
    if (take > 0) {
      let page: SupportingObservationView[]
      if (index.kind === 'absent') page = [historicalObservation(source)]
      else {
        const jsonPath = `$.items[${start} to ${start + take - 1}]`
        const rows = await prisma.$queryRaw<Array<{ items: unknown }>>`
          SELECT jsonb_path_query_array(f."supportingObservations", ${jsonPath}::jsonpath) AS items
          FROM flags f JOIN audits a ON a.id = f."auditId" JOIN projects p ON p.id = a."projectId"
          JOIN users u ON u.id = p."userId"
          WHERE f.id = ${source.id} AND f."auditId" = ${source.auditId}
            AND f."supportingObservationVersion" = ${index.sourceVersion}
            AND p.id = ${site.projectId} AND p."userId" = ${site.userId}
            AND p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE'`
        if (rows.length !== 1) return changed(site)
        page = publicSupportingObservations({ version: 1, items: rows[0].items })
        if (page.length !== take) return changed(site)
      }
      observations.push(...page.map(item => grouped ? { ...item, sourceFlagId: source.id,
        sourceAuditId: item.sourceAuditId ?? source.auditId } : item))
    }
    preceding += index.count
  }
  // A peer outside this window can change its source while the requested page
  // is read. Revalidate every source's scalar version before private delivery.
  const current = await prisma.flag.findMany({ where: { OR: sources.map(source => ({ id: source.id, auditId: source.auditId,
    supportingObservationVersion: source.supportingObservationVersion ?? 0 })), audit: { projectId: site.projectId } }, select: { id: true } })
  if (current.length !== sources.length) return changed(site)
  return { offset, total, observations: total === null ? null : observations, revision }
}
