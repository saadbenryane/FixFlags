import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { loadAdminSite } from '@/lib/admin/workspace-queries'
import { adminDate } from '@/lib/admin/format'
import { AdminPageFrame, AdminSurface } from '@/components/admin/AdminPageFrame'
import { SiteControls } from '@/components/admin/SiteControls'
export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminPage()
  const data = await loadAdminSite(actor, (await params).id)
  if (!data) notFound()
  return (
    <AdminPageFrame
      title={data.name}
      description={data.canonicalHost !== data.name ? (data.canonicalHost ?? undefined) : undefined}
    >
      <Link href={`/admin/users/${data.user.id}`} className="text-sm underline break-all">
        {data.user.email}
      </Link>
      <div className="grid gap-4 md:grid-cols-2">
        <AdminSurface title="Monitoring state">
          <p>
            {data.deletedAt ? 'Removed' : (data.watchInterval ?? 'Off')} ·{' '}
            {data.user.lifecycleStatus.toLowerCase()} account
          </p>
          <p className="text-sm text-muted-foreground">
            Last run: {adminDate(data.watchLastRunAt)}
          </p>
          <p className="text-sm text-muted-foreground">
            Next run: {adminDate(data.watchNextRunAt)}
          </p>
          {data.watchLastError && <p className="text-sm text-destructive">{data.watchLastError}</p>}
        </AdminSurface>
        <AdminSurface title="Uptime">
          <p>{data.uptimeMonitor?.state ?? 'Not configured'}</p>
          <p className="text-sm text-muted-foreground">
            Last probe: {adminDate(data.uptimeMonitor?.lastCheckedAt)}
          </p>
        </AdminSurface>
      </div>
      {!data.deletedAt && (
        <SiteControls
          id={data.id}
          interval={data.watchInterval}
          everyMinutes={data.watchEveryMinutes}
          notificationLevel={data.notificationLevel}
          recovery={data.notifyOnRecovery}
          accountsEnabled={data.accountChecksEnabled}
          remainingAccounts={data.testAccounts.filter((a) => a.state !== 'DELETED').length}
        />
      )}
      <AdminSurface title="Test account cleanup">
        {data.testAccounts.map((account) => (
          <p key={account.id} className="text-sm">
            {account.state} · last checked {adminDate(account.lastCheckedAt)}
          </p>
        ))}
        {!data.testAccounts.length && (
          <p className="text-sm text-muted-foreground">No test accounts recorded.</p>
        )}
      </AdminSurface>
      <AdminSurface title="Recent checks">
        {data.audits.map((audit) => (
          <p key={audit.id} className="py-2 text-sm">
            <Link href={`/admin/audits/${audit.id}`} className="underline">
              {audit.status} · {adminDate(audit.createdAt)}
            </Link>
            {audit.failureCode && ` · ${audit.failureCode}`}
          </p>
        ))}
      </AdminSurface>
      {data.shopifyShops.map((shop) => (
        <Link key={shop.id} href={`/admin/shops/${shop.id}`} className="text-sm underline">
          Inspect Shopify purchase paths
        </Link>
      ))}
    </AdminPageFrame>
  )
}
