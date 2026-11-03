import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { readScreenshot } from '@/lib/storage/screenshots'
import { readIntegrityArtifact } from '@/lib/integrity/storage'
import { outcomeRequestIdForArtifactNamespace } from '@/lib/integrity/artifact-namespace'
import { performanceEvidenceSource } from '../flag-evidence'
import { loadPerformanceEvidence } from './performance-evidence'
import { MAX_MCP_CAPTURE_BYTES, MAX_REPAIR_CAPTURE_BYTES, repairEvidenceSchema, type RepairEvidence } from '../repair-evidence-contract'
import type { SiteRecord } from '../types'
import type { SiteFlagDetail } from '../flags'
import { readSiteEvidence } from './site-evidence-read'

/** Read an exact persisted source asset from private storage. Never fetch a
 * reported URL, forward a key, or substitute the newest Site screenshot. */
export async function loadSiteRepairEvidence(site: SiteRecord, flag: SiteFlagDetail, captureUrl: string) {
  return readSiteEvidence(site, () => readSiteRepairEvidence(site, flag, captureUrl))
}

async function readSiteRepairEvidence(site: SiteRecord, flag: SiteFlagDetail, captureUrl: string) {
  const sourceFlagId = flag.sourceFlagId ?? flag.id
  const performanceMeasurements = flag.evidenceContext?.source === 'DETERMINISTIC' &&
    performanceEvidenceSource(flag.checkId) === 'lab' && flag.pageUrl
    ? await loadPerformanceEvidence(site, flag.sourceAuditId, flag.pageUrl) : []
  const finding = await prisma.journeyFinding.findFirst({ where: { flagId: sourceFlagId,
    journeyReview: { auditId: flag.sourceAuditId,
      audit: site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, url: true, screenshotUrl: true, createdAt: true } })
  let image: Buffer | null = null
  let capture: RepairEvidence['capture'] = { state: finding?.screenshotUrl ? 'unavailable' : 'not_recorded' }
  if (finding?.screenshotUrl && /^[a-zA-Z0-9_-]{1,200}$/.test(flag.sourceAuditId)) {
    try {
      const url = new URL(finding.screenshotUrl, 'https://fixflags.invalid')
      const shot = url.pathname.match(/^\/api\/screenshots\/([a-zA-Z0-9_-]+)\/(desktop|mobile)$/)
      const artifact = url.pathname.match(/^\/api\/integrity-assets\/([a-zA-Z0-9_-]{1,200})\/([a-zA-Z0-9_-]+\.png)$/)
      if (shot && shot[1] === flag.sourceAuditId) {
        const page = url.searchParams.get('page')
        if (!page || /^[a-zA-Z0-9_-]{1,80}$/.test(page)) image = await readScreenshot(flag.sourceAuditId, shot[2], page)
      } else if (artifact && site.projectId) {
        const requestId = outcomeRequestIdForArtifactNamespace(artifact[1])
        if (requestId && await prisma.runRequest.findFirst({ where: { id: requestId, projectId: site.projectId,
          auditId: flag.sourceAuditId }, select: { id: true } })) image = await readIntegrityArtifact(artifact[1], artifact[2])
      }
      if (image && image.length > MAX_REPAIR_CAPTURE_BYTES) capture = { state: 'too_large' }
      else if (image && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        capture = { state: 'available', sha256: createHash('sha256').update(image).digest('hex'), bytes: image.length,
          findingId: finding.id, pageUrl: finding.url,
          mimeType: 'image/png', findingRecordedAt: finding.createdAt.toISOString(), url: captureUrl,
          nativeImage: image.length <= MAX_MCP_CAPTURE_BYTES }
    } catch { capture = { state: 'unavailable' } }
  }
  if (capture.state !== 'available') image = null
  return { evidence: repairEvidenceSchema.parse({ sourceAuditId: flag.sourceAuditId, sourceFlagId,
    performanceMeasurements, capture }), image }
}
