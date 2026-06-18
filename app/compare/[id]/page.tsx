import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getRequestedPath, signInUrl } from '@/lib/auth/redirect-path'
import { Card } from '@/components/ui/card'
import { FlagDiff } from '@/components/compare/FlagDiff'
import { BeforeAfterComparison } from '@/components/audit/BeforeAfterComparison'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { MOBILE_FRAME_WIDTH_CLASS } from '@/lib/audit/viewports'
import { AuditShell } from '@/components/layout/audit-shell'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/empty-state'
import { Muted, SectionTitle } from '@/components/ui/typography'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { resolveCompareUpgradeMoment } from '@/lib/billing/upgrade-moments'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { canAccessAudit } from '@/lib/audit/access'
import { canAccessCompare } from '@/lib/auth/entitlements'
import { isAdminUser } from '@/lib/auth/permissions'
import { computeShareStatusFromRubrics, computeRubricsFromRows } from '@/lib/audit/rubric'
import { RubricDiff } from '@/components/compare/RubricDiff'

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
      rubrics: { include: { flags: { select: { severity: true } } } },
      screenshots: true,
      parent: {
        include: {
          rubrics: { include: { flags: { select: { severity: true } } } },
          screenshots: true,
        },
      },
    },
  })

  if (!recheckAudit) notFound()
  if (!recheckAudit.parentId || !recheckAudit.parent) {
    redirect(`/report/${id}`)
  }
  if (recheckAudit.status !== 'COMPLETED') {
    redirect(`/report/${id}`)
  }

  const showAdmin = isAdminUser(user)

  if (!canAccessCompare(user, recheckAudit)) {
    return (
      <AuditShell session={session} showAdmin={showAdmin}>
        <Container variant="report" className="space-y-8 py-8">
          <PageHeader
            title="Before vs After"
            description="Re-check is required to compare scores."
          />
            <ContextualUpgradeCard
              moment="compare_flat"
              isLoggedIn
              currentPlan={user.plan}
            />
            <Button asChild variant="outline">
              <Link href={`/report/${id}`}>Back to report</Link>
            </Button>
        </Container>
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
  const flagDiff = await getFlagDiffSummary(before.id, after.id)

  const beforeDesktop = before.screenshots.find((s) => s.device === 'DESKTOP')
  const afterDesktop = after.screenshots.find((s) => s.device === 'DESKTOP')
  const beforeMobile = before.screenshots.find((s) => s.device === 'MOBILE')
  const afterMobile = after.screenshots.find((s) => s.device === 'MOBILE')
  const hasMobileCompare = beforeMobile && afterMobile

  const scoreDelta =
    before.score !== null && after.score !== null ? after.score - before.score : 0
  const compareMoment = resolveCompareUpgradeMoment(before.score, after.score)
  const mapRubrics = (rubrics: typeof before.rubrics) =>
    rubrics.map((r) => ({
      name: r.name,
      grade: r.grade,
      score: r.score,
      flags: r.flags.map((f) => ({ severity: f.severity })),
    }))

  const beforeRubrics = computeRubricsFromRows(mapRubrics(before.rubrics))
  const afterRubrics = computeRubricsFromRows(mapRubrics(after.rubrics))
  const beforeShareStatus = computeShareStatusFromRubrics(mapRubrics(before.rubrics))
  const afterShareStatus = computeShareStatusFromRubrics(mapRubrics(after.rubrics))

  return (
    <AuditShell session={session} showAdmin={showAdmin}>
      <Container variant="report" className="space-y-8 py-8">
          <div className="space-y-1">
            <Muted className="truncate text-xs">{after.url}</Muted>
            <PageHeader
              title={
                flagDiff.fixed.length > 0
                  ? `${flagDiff.fixed.length === 1 ? '1 flag cleared' : `${flagDiff.fixed.length} flags cleared`}${
                      flagDiff.unchanged.length === 0 && flagDiff.regressed.length === 0
                        ? '. Clean pass.'
                        : '.'
                    }`
                  : 'Before vs After'
              }
            />
          </div>

        <Card className="flex items-center gap-6 border-0 p-5 shadow-card sm:p-6">
          <div className="text-center">
            <div className="font-mono text-3xl font-medium tabular-nums">{before.score ?? '–'}</div>
            <div className="text-xs text-muted-foreground mt-1">Before</div>
          </div>
          <div className="flex-1 text-center">
            {before.score !== null && after.score !== null ? (
              <div
                className={`font-mono text-2xl font-medium tabular-nums ${after.score > before.score ? 'text-success' : after.score < before.score ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {after.score > before.score ? '+' : ''}
                {after.score - before.score}
              </div>
            ) : (
              <div className="text-2xl text-muted-foreground">–</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">Score change</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-3xl font-medium tabular-nums">{after.score ?? '–'}</div>
            <div className="text-xs text-muted-foreground mt-1">After</div>
          </div>
        </Card>

        {!user.plan || user.plan === 'FREE' ? (
          <ContextualUpgradeCard
            moment={compareMoment}
            scoreDelta={scoreDelta}
            isLoggedIn
            currentPlan={user.plan}
          />
        ) : null}

        <RubricDiff
          beforeShareStatus={beforeShareStatus}
          afterShareStatus={afterShareStatus}
          beforeRubrics={beforeRubrics}
          afterRubrics={afterRubrics}
        />

        {flagDiff.fixed.length === 0 &&
        flagDiff.unchanged.length === 0 &&
        flagDiff.regressed.length === 0 &&
        flagDiff.newIssues.length === 0 ? (
          <EmptyState
            title="No changes detected"
            description="Nothing changed between the two audits."
          />
        ) : (
          <FlagDiff
            fixed={flagDiff.fixed}
            unchanged={flagDiff.unchanged}
            regressed={flagDiff.regressed}
            newIssues={flagDiff.newIssues}
          />
        )}

        {beforeDesktop && afterDesktop && (
          <div className="space-y-3">
            <SectionTitle>Desktop screenshot comparison</SectionTitle>
            <BeforeAfterComparison beforeUrl={beforeDesktop.url} afterUrl={afterDesktop.url} />
          </div>
        )}

        {hasMobileCompare && (
          <div className="space-y-3">
            <SectionTitle>Mobile screenshot comparison</SectionTitle>
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

        {flagDiff.fixed.length > 0 && (
          <div className="rounded-card border-0 bg-grade-A/5 p-5 shadow-card space-y-2">
            <p className="text-sm font-semibold text-success">
              {flagDiff.fixed.length === 1 ? '1 flag fixed.' : `${flagDiff.fixed.length} flags fixed.`} Share the proof.
            </p>
            <p className="text-sm text-muted-foreground">
              This comparison is shareable. Send it to your client, team, or post it with your launch.
            </p>
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <Button asChild variant="outline">
            <Link href={`/report/${before.id}`}>View original report</Link>
          </Button>
          <Button asChild>
            <Link href={`/report/${after.id}`}>View latest report</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Check another URL</Link>
          </Button>
        </div>
      </Container>
    </AuditShell>
  )
}
