import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getRequestedPath, signInUrl } from '@/lib/auth/redirect-path'
import { AreaDiff } from '@/components/compare/AreaDiff'
import { FindingDiff } from '@/components/compare/FindingDiff'
import { BeforeAfterComparison } from '@/components/audit/BeforeAfterComparison'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { MOBILE_FRAME_WIDTH_CLASS } from '@/lib/audit/viewports'
import { AuditShell } from '@/components/layout/audit-shell'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Muted } from '@/components/ui/typography'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { resolveCompareUpgradeMoment } from '@/lib/billing/upgrade-moments'
import { getFindingDiffSummary } from '@/lib/audit/diff-findings'
import { canAccessAudit } from '@/lib/audit/access'
import { canAccessCompare } from '@/lib/auth/entitlements'
import { isAdminUser } from '@/lib/auth/permissions'
import { parseLaunchReadiness } from '@/lib/audit/launch-readiness'
import { LaunchReadinessDiff } from '@/components/compare/LaunchReadinessDiff'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ComparePage({ params }: Props) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  if (!session?.user) {
    redirect(`/sign-in?next=/compare/${id}`)
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) {
    redirect(signInUrl(await getRequestedPath(`/compare/${id}`)))
  }

  const recheckAudit = await prisma.audit.findUnique({
    where: { id },
    include: {
      areas: true,
      screenshots: true,
      parent: {
        include: {
          areas: true,
          screenshots: true,
        },
      },
    },
  })

  if (!recheckAudit) notFound()
  if (!recheckAudit.parentId || !recheckAudit.parent) {
    redirect(`/audit/${id}`)
  }
  if (recheckAudit.status !== 'COMPLETED') {
    redirect(`/audit/${id}`)
  }

  const showAdmin = isAdminUser(user)

  if (!canAccessCompare(user, recheckAudit)) {
    return (
      <AuditShell session={session} showAdmin={showAdmin}>
        <Section spacing="default">
          <Container className="max-w-3xl py-12 space-y-6">
            <div className="space-y-1">
              <Heading as="h1">Before vs After</Heading>
              <Muted>Re-check is required to compare scores.</Muted>
            </div>
            <ContextualUpgradeCard
              moment="trial_exhausted"
              isLoggedIn
              currentPlan={user.plan}
            />
            <Button asChild variant="outline">
              <Link href={`/audit/${id}`}>Back to report</Link>
            </Button>
          </Container>
        </Section>
      </AuditShell>
    )
  }

  if (
    !canAccessAudit(recheckAudit, session.user) ||
    !canAccessAudit(recheckAudit.parent, session.user)
  ) {
    notFound()
  }

  const before = recheckAudit.parent
  const after = recheckAudit
  const findingDiff = await getFindingDiffSummary(before.id, after.id)

  const beforeDesktop = before.screenshots.find((s) => s.device === 'DESKTOP')
  const afterDesktop = after.screenshots.find((s) => s.device === 'DESKTOP')
  const beforeMobile = before.screenshots.find((s) => s.device === 'MOBILE')
  const afterMobile = after.screenshots.find((s) => s.device === 'MOBILE')
  const hasMobileCompare = beforeMobile && afterMobile

  const scoreDelta =
    before.score !== null && after.score !== null ? after.score - before.score : 0
  const compareMoment = resolveCompareUpgradeMoment(before.score, after.score)
  const beforeLaunch = parseLaunchReadiness(before.launchReadiness)
  const afterLaunch = parseLaunchReadiness(after.launchReadiness)

  return (
    <AuditShell session={session} showAdmin={showAdmin}>
      <Section spacing="default">
        <Container className="max-w-4xl space-y-8">
          <div className="space-y-1">
            <Heading as="h1">Before vs After</Heading>
            <Muted className="truncate">{after.url}</Muted>
          </div>

        <div className="flex items-center gap-6 p-4 rounded-xl border bg-card">
          <div className="text-center">
            <div className="text-3xl font-bold tabular-nums">{before.score ?? '–'}</div>
            <div className="text-xs text-muted-foreground mt-1">Before</div>
          </div>
          <div className="flex-1 text-center">
            {before.score !== null && after.score !== null ? (
              <div
                className={`text-2xl font-bold tabular-nums ${after.score > before.score ? 'text-success' : after.score < before.score ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {after.score > before.score ? '+' : ''}
                {after.score - before.score}
              </div>
            ) : (
              <div className="text-2xl text-muted-foreground">–</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">Overall change</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold tabular-nums">{after.score ?? '–'}</div>
            <div className="text-xs text-muted-foreground mt-1">After</div>
          </div>
        </div>

        {!user.plan || user.plan === 'FREE' ? (
          <ContextualUpgradeCard
            moment={compareMoment}
            scoreDelta={scoreDelta}
            isLoggedIn
            currentPlan={user.plan}
          />
        ) : null}

        <LaunchReadinessDiff before={beforeLaunch} after={afterLaunch} />

        <AreaDiff beforeAreas={before.areas} afterAreas={after.areas} />

        <FindingDiff
          fixed={findingDiff.fixed}
          regressed={findingDiff.regressed}
          newIssues={findingDiff.newIssues}
        />

        {beforeDesktop && afterDesktop && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Desktop screenshot comparison</h2>
            <BeforeAfterComparison beforeUrl={beforeDesktop.url} afterUrl={afterDesktop.url} />
          </div>
        )}

        {hasMobileCompare && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Mobile screenshot comparison</h2>
            <div className="flex flex-wrap gap-6 justify-center">
              <div className={MOBILE_FRAME_WIDTH_CLASS}>
                <p className="text-xs text-muted-foreground mb-2 text-center">Before</p>
                <BrowserFrame
                  device="mobile"
                  imageUrl={beforeMobile!.url}
                  state="loaded"
                  url={before.url}
                />
              </div>
              <div className={MOBILE_FRAME_WIDTH_CLASS}>
                <p className="text-xs text-muted-foreground mb-2 text-center">After</p>
                <BrowserFrame
                  device="mobile"
                  imageUrl={afterMobile!.url}
                  state="loaded"
                  url={after.url}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href={`/audit/${before.id}`}>View original audit</Link>
          </Button>
          <Button asChild>
            <Link href={`/audit/${after.id}`}>View latest audit</Link>
          </Button>
        </div>
        </Container>
      </Section>
    </AuditShell>
  )
}
