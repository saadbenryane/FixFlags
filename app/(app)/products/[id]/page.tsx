import { notFound, redirect } from 'next/navigation'
import { ProductWorkspace } from '@/components/product/ProductWorkspace'
import { Container } from '@/components/ui/container'
import { getAppViewer } from '@/lib/auth/app-viewer'
import { canAccessProductWatch, canSharePublicly } from '@/lib/auth/entitlements'
import { loadProductWorkspace } from '@/lib/products/workspace'
import { recordRecommendedImprovements } from '@/lib/improvements/service'

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getAppViewer()
  if (!viewer) redirect('/sign-in')
  const { id } = await params
  const workspace = await loadProductWorkspace(id, viewer.user.id, {
    signalsEligible: canAccessProductWatch(viewer.user),
    canDailyWatch: canSharePublicly(viewer.user),
  })
  if (!workspace) notFound()
  await recordRecommendedImprovements({
    projectId: workspace.product.id,
    userId: viewer.user.id,
    improvementIds: workspace.attention.map((item) => item.id),
  })

  return (
    <Container variant="report" className="px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:px-0">
      <ProductWorkspace workspace={workspace} />
    </Container>
  )
}
