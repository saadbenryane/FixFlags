import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { loadAdminSites } from '@/lib/admin/workspace-queries'
import { adminDate } from '@/lib/admin/format'
import { AdminPageFrame, AdminSurface } from '@/components/admin/AdminPageFrame'
import { AdminListSearch, AdminPagination } from '@/components/admin/AdminListControls'
export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const actor = await requireAdminPage()
  const data = await loadAdminSites(actor, await searchParams)
  return (
    <AdminPageFrame
      title="Sites"
      description="Inspect monitoring, execution, test accounts, and connected purchase paths."
    >
      <div className="flex flex-wrap gap-4">
        <Link href="/admin/shops" className="text-sm underline">
          Shopify installations
        </Link>
        <Link href="/admin/audits" className="text-sm underline">
          Check history
        </Link>
      </div>
      <AdminListSearch path="/admin/sites" q={data.q} label="Search Site, owner, or ID" />
      <div className="grid gap-4 xl:grid-cols-2">
        {data.rows.map((site) => (
          <AdminSurface key={site.id}>
            <h2 className="text-lg font-semibold">
              <Link href={`/admin/sites/${site.id}`}>{site.name}</Link>
            </h2>
            {site.canonicalHost !== site.name && (
              <p className="text-sm break-all text-muted-foreground">{site.canonicalHost}</p>
            )}
            <p className="text-sm">
              {site.watchInterval ?? 'Monitoring off'} · {site.user.lifecycleStatus.toLowerCase()}{' '}
              account
            </p>
            <p className="text-sm text-muted-foreground">
              Last monitoring run: {adminDate(site.watchLastRunAt)}
            </p>
            <Link href={`/admin/users/${site.user.id}`} className="text-sm underline break-all">
              {site.user.email}
            </Link>
          </AdminSurface>
        ))}
      </div>
      {!data.rows.length && (
        <p className="text-sm text-muted-foreground">No Sites match this view.</p>
      )}
      <AdminPagination
        path="/admin/sites"
        {...data.pagination}
        total={data.total}
        filters={{ q: data.q }}
      />
    </AdminPageFrame>
  )
}
