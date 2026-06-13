import Link from 'next/link'
import { AreaGrid } from '@/components/audit/AreaGrid'
import { AreaCard } from '@/components/audit/AreaCard'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { PriorityFindings } from '@/components/audit/PriorityFindings'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { UPSELLS } from '@/lib/marketing/copy'
import { FREE_FINDING_LIMIT } from '@/lib/audit/access'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'
import { AREA_ORDER } from '@/lib/audit/constants'
import { gradeRank } from '@/lib/utils'

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
  auditId?: string
  isPaid: boolean
  isLoggedIn: boolean
  variant?: 'default' | 'sample'
  showRecheckHint?: boolean
  canUseFreeRecheck?: boolean
  hasUsedFreeRecheck?: boolean
  canSharePublicly?: boolean
  screenshotLimited?: boolean
}

function worstAreaName(areas: Area[]): string | null {
  const ranked = [...areas].sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade))
  const worst = ranked.find((a) => a.grade !== 'A')
  return worst?.name ?? null
}

export function AuditReport({
  audit,
  auditId,
  isPaid,
  isLoggedIn,
  variant = 'default',
  showRecheckHint = false,
  canUseFreeRecheck = false,
  hasUsedFreeRecheck = false,
  canSharePublicly = false,
  screenshotLimited = false,
}: AuditReportProps) {
  const isSample = variant === 'sample'
  const showFeedback = !isSample
  const signUpHref = auditId ? `/sign-up?next=/audit/${auditId}` : '/sign-up'
  const worstArea = worstAreaName(audit.areas)

  const hiddenCount = audit.areas.reduce((sum, area) => {
    const hidden = Math.max(0, (area.findings?.length ?? 0) - FREE_FINDING_LIMIT)
    return sum + hidden
  }, 0)

  const upgradeMoment =
    !isSample && isLoggedIn && !isPaid
      ? resolveFreeUserUpgradeMoment({
          hiddenCount,
          canUseFreeRecheck,
          hasUsedFreeRecheck,
        })
      : null

  const showShareBlocked = !isSample && isLoggedIn && !isPaid && !canSharePublicly

  return (
    <Container className="max-w-4xl py-8 space-y-8">
      <AuditReportHero
        pageJob={audit.pageJob!}
        pageType={audit.pageType!}
        verdict={audit.verdict!}
        score={audit.score!}
        url={audit.url}
        screenshots={audit.screenshots}
        screenshotLimited={screenshotLimited}
      />

      <PriorityFindings areas={audit.areas} showFeedback={showFeedback} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-heading">All areas</h2>
        <AreaGrid areas={audit.areas} />
      </section>

      <div className="space-y-3">
        {AREA_ORDER.map((areaName) => {
          const area = audit.areas.find((a) => a.name === areaName)
          if (!area) return null
          return (
            <AreaCard
              key={area.id}
              area={area}
              isPaid={isPaid}
              defaultOpen={area.name === worstArea}
              showFeedback={showFeedback}
            />
          )
        })}
      </div>

      {showRecheckHint && (isPaid || canUseFreeRecheck) && (
        <div className="rounded-xl bg-muted/30 p-5 space-y-2">
          <h3 className="font-semibold text-sm">Next: prove your fixes worked</h3>
          <p className="text-sm text-muted-foreground text-pretty">
            Paste fix prompts into your editor, ship the changes, then hit{' '}
            <strong>{canUseFreeRecheck && !isPaid ? 'Re-check free (1x)' : 'Re-check'}</strong> above
            to compare before/after scores.
          </p>
        </div>
      )}

      {showShareBlocked && (
        <ContextualUpgradeCard moment="share_blocked" isLoggedIn currentPlan="FREE" />
      )}

      {isSample && (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <h3 className="font-semibold">Run the same audit on your site</h3>
          <p className="text-sm text-muted-foreground text-pretty">
            Paste a URL. Get graded findings across seven areas and copy-ready fix prompts for your
            agent.
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
              <Link href={signUpHref}>{UPSELLS.anon.primaryCta}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pricing">{UPSELLS.anon.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      )}

      {upgradeMoment && upgradeMoment !== 'share_blocked' && (
        <ContextualUpgradeCard
          moment={upgradeMoment}
          hiddenCount={hiddenCount}
          isLoggedIn
          currentPlan="FREE"
          showCta={upgradeMoment !== 'trial_recheck_available'}
        />
      )}
    </Container>
  )
}
