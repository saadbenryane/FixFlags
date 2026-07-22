import Link from 'next/link'
import { AuditReport } from '@/components/audit/AuditReport'
import { DevSampleMetaLogger } from '@/components/marketing/DevSampleMetaLogger'
import { Section } from '@/components/ui/section'
import { parseEvidenceAnchorsFromPerformanceData } from '@/lib/audit/evidence-highlights'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'
import { resolveScreenshotUx } from '@/lib/audit/screenshot-types'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { Button } from '@/components/ui/button'

export default async function SampleDetailsPage() {
  const sample = await getLiveSampleAudit()
  const evidenceAnchors = parseEvidenceAnchorsFromPerformanceData(sample.audit.performanceData)
  const { limited, partial } = resolveScreenshotUx(
    sample.audit.screenshots,
    sample.audit.screenshotCapture
  )

  return (
    <Section spacing="report">
      <DevSampleMetaLogger
        source={sample.source}
        completedAt={sample.completedAt}
        pipelineVersion={sample.pipelineVersion}
        isDemoFixture
        isDogfood={false}
      />
      <div className="mx-auto mb-4 max-w-6xl px-4 sm:px-6">
        <Button asChild variant="ghost" className="min-h-11">
          <Link href="/samples">{REPORT_COPY.focused.backToPlan}</Link>
        </Button>
      </div>
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
          previewMeta: sample.audit.previewMeta,
          flowData: sample.audit.flowData,
          actionTimeline: sample.audit.actionTimeline,
          productContract: sample.audit.productContract,
          verifiedLearnings: sample.audit.verifiedLearnings,
          intentionalNotes: sample.audit.intentionalNotes,
          knownRisks: sample.audit.knownRisks,
        }}
        auditId={sample.audit.id}
        viewerIsPaid={false}
        isLoggedIn={false}
        isViewerOwner={false}
        variant="sample"
        screenshotLimited={limited}
        screenshotPartial={partial}
        showPrescription
        journeyReviews={[
          {
            id: 'curated-sample-journey',
            journeyType: 'first-visit',
            status: 'completed',
            goalAchieved: true,
            completedSteps: 2,
            findingsCount: 1,
            steps: [
              {
                stepNumber: 1,
                actionType: 'navigate',
                url: sample.audit.url,
                screenshotAfterUrl: '/demo/hero-original.svg',
                reasoning: 'Reviewed the first-visit message and primary action',
              },
              {
                stepNumber: 2,
                actionType: 'click',
                url: `${sample.audit.url}/signup`,
                screenshotAfterUrl: '/demo/hero-original.svg',
                reasoning: 'Confirmed the CTA destination after scrolling on mobile',
              },
            ],
          },
        ]}
      />
    </Section>
  )
}
