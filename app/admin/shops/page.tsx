import { prisma } from '@/lib/db'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function AdminShopsPage() {
  const shops = await prisma.shopifyShop.findMany({
    orderBy: { installedAt: 'desc' },
    take: 100,
    include: {
      paths: {
        select: { health: true, label: true, lastVerifiedAt: true },
      },
    },
  })

  return (
    <Container className="space-y-6 py-6">
      <PageHeader title="Shops" />
      {shops.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Shopify installs yet.</p>
      ) : (
        <div className="space-y-3">
          {shops.map((shop) => {
            const worst = shop.paths.some((path) => path.health === 'RED')
              ? 'RED'
              : shop.paths.some((path) => path.health === 'UNKNOWN')
                ? 'UNKNOWN'
                : shop.paths.length
                  ? 'GREEN'
                  : 'UNKNOWN'
            return (
              <Card key={shop.id} className="p-4">
                <p className="font-medium">{shop.name ?? shop.shopDomain}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{shop.shopDomain}</p>
                <p className="mt-2 text-sm">
                  {shop.uninstalledAt ? 'Uninstalled' : worst} · {shop.paths.length} paths
                </p>
              </Card>
            )
          })}
        </div>
      )}
    </Container>
  )
}
