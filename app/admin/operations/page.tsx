import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { loadOperations, OPERATION_QUEUES } from '@/lib/admin/operations'
import { adminDate } from '@/lib/admin/format'
import { AdminPageFrame, AdminSurface } from '@/components/admin/AdminPageFrame'
import { AdminActionButton } from '@/components/admin/AdminActionButton'
import { AdminPagination } from '@/components/admin/AdminListControls'
export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ queue?: string; page?: string }>
}) {
  const actor = await requireAdminPage()
  const data = await loadOperations(actor, await searchParams)
  return (
    <AdminPageFrame
      title="Operations"
      description="Find stalled work and follow it through to a recorded outcome."
    >
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <p>
          Execution worker: <strong>{data.worker}</strong>
        </p>
        <Link href="/admin/operating-plan" className="underline">
          Operating readiness
        </Link>
      </div>
      <nav aria-label="Operation queues" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {OPERATION_QUEUES.map((q, i) => (
          <Link
            key={q.id}
            href={`/admin/operations?queue=${q.id}`}
            aria-current={data.queue === q.id ? 'page' : undefined}
            className={`rounded-card p-4 ${data.queue === q.id ? 'bg-muted' : 'bg-muted/30'}`}
          >
            <span className="block text-sm">{q.label}</span>
            <strong className="text-2xl tabular-nums">{data.counts[i]}</strong>
          </Link>
        ))}
      </nav>
      {!data.rows.length && (
        <AdminSurface>
          <p className="text-sm text-muted-foreground">No records in this queue.</p>
        </AdminSurface>
      )}
      {data.rows.map((row) => (
        <AdminSurface key={row.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <h2 className="font-semibold break-all">
                <Link href={`/admin/sites/${row.siteId}`}>{row.label}</Link>
              </h2>
              <p className="text-sm">{row.state}</p>
              <p className="text-sm text-muted-foreground">{adminDate(row.at)}</p>
            </div>
            {row.auditId ? (
              <Link href={`/admin/audits/${row.auditId}`} className="inline-flex min-h-11 items-center rounded-control px-3 text-sm underline">
                Inspect check
              </Link>
            ) : row.action ? (
              <AdminActionButton action={row.action} targetId={row.targetId} />
            ) : null}
          </div>
        </AdminSurface>
      ))}
      <AdminPagination
        path="/admin/operations"
        {...data.pagination}
        total={data.total}
        filters={{ queue: data.queue }}
      />
    </AdminPageFrame>
  )
}
