import Link from 'next/link'
import { AuditVerdict } from '@/components/audit/AuditVerdict'
import { AreaGrid } from '@/components/audit/AreaGrid'
import { AreaCard } from '@/components/audit/AreaCard'
import { ScreenshotViewer } from '@/components/audit/ScreenshotViewer'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { UPSELLS } from '@/lib/marketing/copy-client'
import { FREE_FINDING_LIMIT } from '@/lib/audit/access'

const AREA_ORDER = ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE']

interface Finding {
  id: string
  severity: string
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  agentPrompt?: string | null
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
}

interface Area {
  id: string
  name: string
  grade: string
  score: number | null
  status: string
  summary: string
  areaPrompt: string
  findings: Finding[]
}

interface AuditReportProps {
  audit: {
    pageJob: string | null
    pageType: string | null
    verdict: string | null
    score: number | null
    url: string
    screenshots?: Array<{ device: 'DESKTOP' | 'MOBILE'; url: string }>
    areas: Area[]
  }
  isPaid: boolean
  isLoggedIn: boolean
  variant?: 'default' | 'sample'
}

export function AuditReport({ audit, isPaid, isLoggedIn, variant = 'default' }: AuditReportProps) {
  const isSample = variant === 'sample'
  const showFeedback = !isSample
  return (
    <Container className="max-w-3xl py-8 space-y-8">
      <AuditVerdict
        pageJob={audit.pageJob!}
        pageType={audit.pageType!}
        verdict={audit.verdict!}
        score={audit.score!}
        url={audit.url}
      />

      {audit.screenshots && audit.screenshots.length > 0 && (
        <ScreenshotViewer screenshots={audit.screenshots} />
      )}

      <AreaGrid areas={audit.areas} />

      <div className="space-y-3">
        {AREA_ORDER.map((areaName) => {
          const area = audit.areas.find((a) => a.name === areaName)
          if (!area) return null
          return (
            <AreaCard
              key={area.id}
              area={area}
              isPaid={isPaid}
              defaultOpen={area.grade !== 'A'}
              showFeedback={showFeedback}
            />
          )
        })}
      </div>

      {isSample && (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <h3 className="font-semibold">Run the same audit on your site</h3>
          <p className="text-sm text-muted-foreground">
            Paste a URL. Get graded findings across seven areas and copy-ready fix prompts for your agent.
          </p>
          <Button asChild>
            <Link href="/">Audit your site</Link>
          </Button>
        </div>
      )}

      {!isSample && !isLoggedIn && (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <h3 className="font-semibold">{UPSELLS.anon.headline}</h3>
          <p className="text-sm text-muted-foreground">{UPSELLS.anon.body}</p>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <Link href="/sign-up">{UPSELLS.anon.primaryCta}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pricing">{UPSELLS.anon.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      )}

      {!isSample && isLoggedIn && !isPaid && (() => {
        const hiddenCount = audit.areas.reduce((sum, area) => {
          const hidden = Math.max(0, (area.findings?.length ?? 0) - FREE_FINDING_LIMIT)
          return sum + hidden
        }, 0)

        return (
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center space-y-3">
            <h3 className="font-semibold">{UPSELLS.freeUser.headline(hiddenCount)}</h3>
            <p className="text-sm text-muted-foreground">{UPSELLS.freeUser.body}</p>
            <Button asChild>
              <Link href="/pricing">{UPSELLS.freeUser.cta}</Link>
            </Button>
          </div>
        )
      })()}
    </Container>
  )
}
