import { notFound, redirect } from 'next/navigation'
import { ProductWorkspace } from '@/components/product/ProductWorkspace'
import { Container } from '@/components/ui/container'
import { getAppViewer } from '@/lib/auth/app-viewer'
import {
  canAccessProductWatch,
  canSharePublicly,
} from '@/lib/auth/entitlements'
import {
  loadProductWorkspace,
  parseProductHistoryCursor,
} from '@/lib/products/workspace'
import { recordRecommendedImprovements } from '@/lib/improvements/service'

type ProductPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ historyCursor?: string }>
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const viewer = await getAppViewer()
  if (!viewer) redirect('/sign-in')
  const { id } = await params
  const query = searchParams ? await searchParams : undefined
  const workspace = await loadProductWorkspace(id, viewer.user.id, {
    signalsEligible: canAccessProductWatch(viewer.user),
    canDailyWatch: canSharePublicly(viewer.user),
    historyCursor: parseProductHistoryCursor(query?.historyCursor),
  })
  if (!workspace) notFound()

  const attentionIds = workspace.attention.map((item) => item.id)
  async function recordVisibleAttention() {
    'use server'
    const currentViewer = await getAppViewer()
    if (!currentViewer) return
    await recordRecommendedImprovements({
      projectId: id,
      userId: currentViewer.user.id,
      improvementIds: attentionIds,
    })
  }

  return (
    <Container
      variant="report"
      className="px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:px-0"
    >
      <ProductWorkspace
        workspace={workspace}
        onAttentionVisible={
          attentionIds.length > 0 ? recordVisibleAttention : undefined
        }
      />
    </Container>
  )
}
