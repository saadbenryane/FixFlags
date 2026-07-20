import { AuditReport } from '@/components/audit/AuditReport'
import { DevSampleMetaLogger } from '@/components/marketing/DevSampleMetaLogger'
import { Section } from '@/components/ui/section'
import { parseEvidenceAnchorsFromPerformanceData } from '@/lib/audit/evidence-highlights'
import { getSampleSiteDisplay } from '@/lib/marketing/display-meta'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'
import { resolveScreenshotUx } from '@/lib/audit/screenshot-types'

export const metadata = buildPageMetadata('samples', '/samples')
export const dynamic = 'force-dynamic'

export default async function SamplesPage() {
  const sample = await getLiveSampleAudit()
  const site = getSampleSiteDisplay(sample.audit.url)
  const evidenceAnchors = parseEvidenceAnchorsFromPerformanceData(sample.audit.performanceData)

  const screenshots = sample.audit.screenshots ?? []
  const { limited, partial } = resolveScreenshotUx(
    screenshots,
    sample.audit.screenshotCapture
  )

  return (
    <Section spacing="report">
      <DevSampleMetaLogger
        source={sample.source}
        completedAt={sample.completedAt}
        pipelineVersion={sample.pipelineVersion}
        isDemoFixture={site.isDemoFixture || sample.source === 'fixture'}
        isDogfood={site.isDogfood}
      />

      <AuditReport
        audit={{
          pageType: sample.audit.pageType,
          verdict: sample.audit.verdict,
          score: sample.audit.score,
          url: sample.audit.url,
          screenshots: sample.audit.screenshots,
          screenshotCapture: sample.audit.screenshotCapture,
          rubrics: sample.audit.rubrics,
          rubricRows: sample.audit.rubricRows,
          flags: sample.audit.flags,
          shareStatus: sample.audit.shareStatus,
          launchReadiness: sample.audit.launchReadiness,
          reportCompleteness: sample.audit.reportCompleteness,
          pipelineVersion: sample.audit.pipelineVersion,
          startedAt: sample.audit.startedAt,
          completedAt: sample.audit.completedAt,
          pageSpeedErrors: sample.audit.pageSpeedErrors,
          evidenceAnchors,
        }}
        auditId={sample.audit.id}
        viewerIsPaid={false}
        isLoggedIn={false}
        isViewerOwner={false}
        variant="sample"
        screenshotLimited={limited}
        screenshotPartial={partial}
        showPrescription
      />
    </Section>
  )
}
