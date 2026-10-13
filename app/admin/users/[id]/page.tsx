import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { loadAdminCustomer } from '@/lib/admin/workspace-queries'
import { adminDate } from '@/lib/admin/format'
import { AdminPageFrame, AdminSurface } from '@/components/admin/AdminPageFrame'
import { CustomerControls } from '@/components/admin/CustomerControls'
import { AdminActionButton } from '@/components/admin/AdminActionButton'
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminPage()
  const data = await loadAdminCustomer(actor, (await params).id)
  if (!data) notFound()
  return (
    <AdminPageFrame title={data.name ?? 'Customer'} description={data.email}>
      <div className="grid gap-4 md:grid-cols-2">
        <AdminSurface title="Effective access">
          <p>
            {data.lifecycleStatus} · {data.effective.plan}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.effective.maxSites ?? 'Unlimited'} Sites ·{' '}
            {data.effective.scanLimit ?? 'Unlimited'} checks per usage period
          </p>
          <p className="text-sm">
            Sources: {data.effective.sources.join(', ').toLowerCase().replaceAll('_', ' ')}
          </p>
        </AdminSurface>
        <AdminSurface title="Commercial state">
          <p>
            {data.plan} · {data.status}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.subscription
              ? `${data.subscription.status}, ${data.subscription.cancelAt ? `cancellation scheduled for ${adminDate(data.subscription.cancelAt)}` : data.subscription.cancelAtPeriodEnd ? 'cancellation scheduled' : data.subscription.scheduleId ? 'managed by a provider schedule' : 'continues at renewal'}. Period ends ${adminDate(data.subscription.periodEnd)}. Observed ${adminDate(data.subscription.observedAt)}.`
              : 'No provider snapshot recorded.'}
          </p>
        </AdminSurface>
      </div>
      <AdminSurface title="Sites">
        <div className="flex flex-wrap gap-4">
          {data.sites.map((site) => (
            <Link key={site.id} href={`/admin/sites/${site.id}`} className="text-sm underline">
              {site.name}
            </Link>
          ))}
        </div>
        {!data.sites.length && <p className="text-sm text-muted-foreground">No active Sites.</p>}
      </AdminSurface>
      <CustomerControls
        id={data.id}
        status={data.lifecycleStatus}
        hasSubscription={data.hasSubscription && data.status !== 'CANCELED'}
        initialPlan={data.plan}
        initialQuantity={data.licensedSiteQuantity}
      />
      {data.grants.length > 0 && (
        <AdminSurface title="Access grants">
          {data.grants.map((grant) => (
            <div key={grant.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <p className="text-sm">
                {grant.plan ?? 'Custom allowances'} · expires {adminDate(grant.expiresAt)}
                {grant.revoked ? ' · revoked' : ''}
              </p>
              {!grant.revoked && Date.parse(grant.expiresAt) > Date.now() && (
                <AdminActionButton action="ENTITLEMENT_REVOKE" targetId={grant.id} />
              )}
            </div>
          ))}
        </AdminSurface>
      )}
      <Link href={`/admin/billing?q=${encodeURIComponent(data.id)}`} className="text-sm underline">
        Payment and refund history
      </Link>
    </AdminPageFrame>
  )
}
