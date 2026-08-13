import { notFound, redirect } from 'next/navigation'
import { ProductWorkspace } from '@/components/product/ProductWorkspace'
import { Container } from '@/components/ui/container'
import { getAppViewer } from '@/lib/auth/app-viewer'
import { canAccessProductWatch } from '@/lib/auth/entitlements'
import { loadProductWorkspace } from '@/lib/products/workspace'

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getAppViewer()
  if (!viewer) redirect('/sign-in')
  const { id } = await params
  const workspace = await loadProductWorkspace(id, viewer.user.id, {
    signalsEligible: canAccessProductWatch(viewer.user),
  })
  if (!workspace) notFound()

  return (
    <Container variant="report" className="px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:px-0">
      <ProductWorkspace workspace={workspace} />
    </Container>
  )
}
