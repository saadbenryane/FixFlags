import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn, gradeColor, areaLabel } from '@/lib/utils'
import { Plus, ExternalLink } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { UsageMeter } from '@/components/dashboard/UsageMeter'
import { PLAN_LIMITS } from '@/lib/stripe'
import { Plan } from '@prisma/client'

const AREA_ORDER = ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE']

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = await prisma.user.findUnique({ where: { id: session!.user.id } })

  const audits = await prisma.audit.findMany({
    where: { userId: session!.user.id, status: 'COMPLETED' },
    include: { areas: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const limit = PLAN_LIMITS[user?.plan as Plan ?? 'FREE'].audits
  const used = user?.auditsUsed ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 max-w-xs space-y-1">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <UsageMeter
            used={used}
            limit={limit === Infinity ? null : limit}
            plan={user?.plan ?? 'FREE'}
          />
        </div>
        <Button asChild>
          <Link href="/">
            <Plus className="h-4 w-4 mr-2" />
            New audit
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border p-4 bg-muted/20">
        <p className="text-sm font-medium mb-3">Audit a new URL</p>
        <AuditInput />
      </div>

      {audits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No audits yet. Paste a URL above to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Recent audits</h2>
          {audits.map((audit) => {
            const orderedAreas = AREA_ORDER.map((n) =>
              audit.areas.find((a) => a.name === n)
            ).filter(Boolean)

            return (
              <Link key={audit.id} href={`/audit/${audit.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{audit.url}</div>
                        <div className="text-xs text-muted-foreground">
                          Score: {audit.score ?? '–'} · {new Date(audit.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {orderedAreas.map((area) => area && (
                          <div
                            key={area.name}
                            className={cn(
                              'text-xs font-bold px-1.5 py-0.5 rounded border',
                              gradeColor(area.grade)
                            )}
                            title={areaLabel(area.name)}
                          >
                            {area.grade}
                          </div>
                        ))}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
