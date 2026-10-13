import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { adminRead } from '@/lib/admin/workspace-queries'
import { adminDate } from '@/lib/admin/format'
import { AdminPageFrame, AdminSurface } from '@/components/admin/AdminPageFrame'
import { AdminActionButton } from '@/components/admin/AdminActionButton'
export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminPage(),
    { id } = await params
  const shop = await adminRead(actor, (db) =>
    db.shopifyShop.findUnique({
      where: { id },
      select: {
        id: true,
        shopDomain: true,
        projectId: true,
        uninstalledAt: true,
        tokenExpiresAt: true,
        paths: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            label: true,
            health: true,
            reason: true,
            failedStep: true,
            lastVerifiedAt: true,
          },
        },
      },
    }),
  )
  if (!shop) notFound()
  return (
    <AdminPageFrame
      title={shop.shopDomain}
      description="Purchase path health and installation readiness."
    >
      <AdminSurface title="Connection">
        <p>
          {shop.uninstalledAt
            ? 'Uninstalled'
            : shop.tokenExpiresAt && shop.tokenExpiresAt <= new Date()
              ? 'Credential refresh required'
              : 'Installed'}
        </p>
        {shop.projectId && (
          <Link href={`/admin/sites/${shop.projectId}`} className="text-sm underline">
            Open connected Site
          </Link>
        )}
        {!shop.uninstalledAt && (
          <div className="flex flex-wrap gap-3">
            <AdminActionButton action="SHOP_RECHECK" targetId={id} />
            <AdminActionButton action="SHOP_DISCONNECT" targetId={id} />
          </div>
        )}
      </AdminSurface>
      {shop.paths.map((path) => (
        <AdminSurface key={path.id} title={path.label}>
          <p>
            {path.health} · last verified {adminDate(path.lastVerifiedAt)}
          </p>
          {path.failedStep && <p className="text-sm">Failed step: {path.failedStep}</p>}
          {path.reason && <p className="text-sm text-muted-foreground">{path.reason}</p>}
        </AdminSurface>
      ))}
      {!shop.paths.length && (
        <p className="text-sm text-muted-foreground">No purchase paths recorded.</p>
      )}
    </AdminPageFrame>
  )
}
