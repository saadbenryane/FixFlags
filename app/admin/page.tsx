import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { loadAdminOverview } from '@/lib/admin/workspace-queries'
import { AdminPageFrame, AdminSurface } from '@/components/admin/AdminPageFrame'
import { MetricCard } from '@/components/admin/MetricCard'
export default async function AdminPage() {
  const actor = await requireAdminPage()
  const data = await loadAdminOverview(actor)
  return (
    <AdminPageFrame
      title="Overview"
      description="Keep Sites running, help customers, and follow every operator action."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ['Sites', data.sites, '/admin/sites'],
          ['Accounts', data.customers, '/admin/users'],
          ['Open conversations', data.openSupport, '/admin/feedback?tab=conversations'],
          ['Failed checks in 24 hours', data.failures, '/admin/audits?status=FAILED'],
          ['Actions in progress', data.queued, '/admin/activity'],
          ['Unconfirmed outcomes', data.uncertain, '/admin/activity'],
        ].map(([label, value, href]) => (
          <MetricCard
            key={String(label)}
            label={String(label)}
            value={Number(value)}
            action={
              <Link href={href as '/admin'} className="text-sm underline underline-offset-4">
                Open
              </Link>
            }
          />
        ))}
      </div>
      <AdminSurface title="Operating context">
        <p className="text-sm text-muted-foreground">
          Open beta is active. Paid enrollment remains closed. Commercial subscription status and
          complimentary access are shown separately.
        </p>
        <p className="text-sm text-muted-foreground">
          Times are reported in Africa/Casablanca. Stored timestamps use UTC.
        </p>
        <Link href="/admin/operations" className="inline-block text-sm underline">
          Review operations
        </Link>
      </AdminSurface>
    </AdminPageFrame>
  )
}
