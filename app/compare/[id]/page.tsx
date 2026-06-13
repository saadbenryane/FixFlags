import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { AreaDiff } from '@/components/compare/AreaDiff'
import { FindingDiff } from '@/components/compare/FindingDiff'
import { BeforeAfterSlider } from '@/components/compare/BeforeAfterSlider'
import { AuditShell } from '@/components/layout/audit-shell'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Muted } from '@/components/ui/typography'
import { getFindingDiffSummary } from '@/lib/audit/diff-findings'
import { canAccessAudit } from '@/lib/audit/access'
import { canAccessPaidFeatures } from '@/lib/auth/permissions'

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
  if (!user || !canAccessPaidFeatures(user)) {
    redirect('/pricing')
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

  return (
    <AuditShell session={session}>
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
                className={`text-2xl font-bold tabular-nums ${after.score > before.score ? 'text-green-600' : after.score < before.score ? 'text-destructive' : 'text-muted-foreground'}`}
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

        <AreaDiff beforeAreas={before.areas} afterAreas={after.areas} />

        <FindingDiff
          fixed={findingDiff.fixed}
          regressed={findingDiff.regressed}
          newIssues={findingDiff.newIssues}
        />

        {beforeDesktop && afterDesktop && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Screenshot comparison</h2>
            <BeforeAfterSlider beforeUrl={beforeDesktop.url} afterUrl={afterDesktop.url} />
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
