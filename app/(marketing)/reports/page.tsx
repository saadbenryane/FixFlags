import Link from 'next/link'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { SectionTitle } from '@/components/ui/typography'
import { AuditInput } from '@/components/audit/AuditInput'
import { ExternalLink } from 'lucide-react'

const ANON_AUDIT_IDS_COOKIE = 'ff_anon_report_ids'

function readAnonAuditIds(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export default async function MyScansPage() {
  const cookieStore = await cookies()
  const ids = readAnonAuditIds(cookieStore.get(ANON_AUDIT_IDS_COOKIE)?.value)

  const audits = ids.length > 0
    ? await prisma.audit.findMany({
        where: { id: { in: ids }, userId: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          url: true,
          status: true,
          score: true,
          createdAt: true,
        },
      })
    : []

  return (
    <Container variant="report" className="py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">My scans</h1>
        <p className="text-sm text-muted-foreground">
          Your recent audits. Reports are saved for 30 days.
        </p>
      </div>

      <div className="space-y-4">
        <SectionTitle>Audit a new URL</SectionTitle>
        <AuditInput />
      </div>

      {audits.length === 0 ? (
        <div className="rounded-card border border-border/40 bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No scans yet. Paste a URL above to run your first audit.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <SectionTitle>Recent checks</SectionTitle>
          {audits.map((audit) => {
            const isCompleted = audit.status === 'COMPLETED'
            const statusLabel =
              audit.status === 'FAILED'
                ? 'Failed'
                : isCompleted
                  ? null
                  : 'In progress'

            return (
              <Link key={audit.id} href={`/report/${audit.id}`} className="block">
                <Card interactive>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{audit.url}</div>
                        <div className="text-xs text-muted-foreground">
                          {isCompleted ? (
                            <>Score: {audit.score ?? '–'} · {new Date(audit.createdAt).toLocaleDateString()}</>
                          ) : (
                            new Date(audit.createdAt).toLocaleDateString()
                          )}
                        </div>
                      </div>
                      {statusLabel ? (
                        <Badge
                          variant={audit.status === 'FAILED' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {statusLabel}
                        </Badge>
                      ) : null}
                      {isCompleted && (
                        <div className="flex gap-1 flex-wrap">
                          {audit.score != null && (
                            <span className="text-xs font-medium text-muted-foreground tabular-nums">
                              {audit.score}/100
                            </span>
                          )}
                        </div>
                      )}
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </Container>
  )
}
