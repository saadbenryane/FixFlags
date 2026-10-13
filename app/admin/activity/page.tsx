import { AdminActionButton } from '@/components/admin/AdminActionButton'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { loadAdminActivity } from '@/lib/admin/workspace-queries'
import { ADMIN_COPY } from '@/lib/marketing/copy/admin'
import { adminDate } from '@/lib/admin/format'
import { AdminPageFrame, AdminSurface } from '@/components/admin/AdminPageFrame'
import { AdminPagination } from '@/components/admin/AdminListControls'
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; operation?: string }>
}) {
  const actor = await requireAdminPage()
  const params = await searchParams,
    data = await loadAdminActivity(actor, params)
  return (
    <AdminPageFrame
      title="Activity"
      description="Durable operator history remains available after its customer or Site is removed."
    >
      {!data.rows.length && (
        <p className="text-sm text-muted-foreground">No operator actions recorded.</p>
      )}
      {data.rows.map((operation) => (
        <AdminSurface key={operation.id}>
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="font-semibold">
              {ADMIN_COPY.actions[operation.action as keyof typeof ADMIN_COPY.actions] ??
                operation.action}
            </h2>
            <span className="text-sm">{ADMIN_COPY.statuses[operation.status]}</span>
          </div>
          <p className="text-sm break-all text-muted-foreground">
            {operation.targetType.toLowerCase()} {operation.targetId} · operator {operation.actorId}
          </p>
          <p className="text-sm">{operation.reason}</p>
          {operation.errorMessage && (
            <p className="text-sm text-destructive">{operation.errorMessage}</p>
          )}
          {operation.status === 'INDETERMINATE' && (
            <AdminActionButton action="OPERATION_RECONCILE" targetId={operation.id} />
          )}
          <details className="text-sm">
            <summary className="cursor-pointer py-2">Recorded events</summary>
            <ol className="space-y-3 py-2">
              {operation.events.map((event) => (
                <li key={event.id}>
                  <span className="font-medium">{event.type}</span>
                  <span className="ml-3 text-muted-foreground">{adminDate(event.occurredAt)}</span>
                  <pre className="mt-1 whitespace-pre-wrap break-all text-xs">
                    {JSON.stringify(event.detail, null, 2)}
                  </pre>
                </li>
              ))}
            </ol>
          </details>
        </AdminSurface>
      ))}
      <AdminPagination
        path="/admin/activity"
        {...data.pagination}
        total={data.total}
        filters={{ operation: params.operation }}
      />
    </AdminPageFrame>
  )
}
