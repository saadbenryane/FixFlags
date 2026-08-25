import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
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
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { resolveAuditAccess } from '@/lib/audit/access'
import { SHARE_GRANT_COOKIE } from '@/lib/security/share-grant'
import { isAdminUser } from '@/lib/auth/permissions'
import { computeShareStatusFromRubrics, computeRubricsFromRows } from '@/lib/audit/rubric'
import { RubricDiff } from '@/components/compare/RubricDiff'
import { ShareCompareButton } from '@/components/audit/ShareCompareButton'
import { RecheckCompletedTracker } from '@/components/audit/RecheckCompletedTracker'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ share?: string }>
}

export default async function ComparePage({ params, searchParams }: Props) {
  const { id } = await params
  await searchParams
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  const monitoringAudit = await prisma.audit.findUnique({
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

  if (!monitoringAudit) notFound()
  if (!monitoringAudit.parentId || !monitoringAudit.parent) {
    redirect(`/report/${id}`)
  }
  if (monitoringAudit.status !== 'COMPLETED') {
    redirect(`/report/${id}`)
  }

  let showAdmin = false
  const grantValue = (await cookies()).get(SHARE_GRANT_COOKIE)?.value
  const childAccess = await resolveAuditAccess(monitoringAudit, session?.user, grantValue)
  const parentAccess = await resolveAuditAccess(monitoringAudit.parent, session?.user, grantValue)
  if (childAccess === 'denied' || parentAccess === 'denied') notFound()

  if (session?.user) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (user) {
      showAdmin = isAdminUser(user)
    }
  }

  const before = monitoringAudit.parent
  const after = monitoringAudit
  const flagDiff = await getFlagDiffSummary(before.id, after.id)

  const beforeDesktop = before.screenshots.find((s) => s.device === 'DESKTOP')
  const afterDesktop = after.screenshots.find((s) => s.device === 'DESKTOP')
  const beforeMobile = before.screenshots.find((s) => s.device === 'MOBILE')
  const afterMobile = after.screenshots.find((s) => s.device === 'MOBILE')
  const hasMobileCompare = beforeMobile && afterMobile

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
      <RecheckCompletedTracker auditId={after.id} parentAuditId={before.id} />
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
            description="Nothing changed between the two checks."
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

        <ShareCompareButton auditId={after.id} />

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
