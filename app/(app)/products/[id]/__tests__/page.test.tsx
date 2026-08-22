import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductPage from '@/app/(app)/products/[id]/page'

const mocks = vi.hoisted(() => ({
  getAppViewer: vi.fn(),
  loadProductWorkspace: vi.fn(),
  parseProductHistoryCursor: vi.fn(),
  recordRecommendedImprovements: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}))

vi.mock('@/lib/auth/app-viewer', () => ({ getAppViewer: mocks.getAppViewer }))
vi.mock('@/lib/auth/entitlements', () => ({
  canAccessProductWatch: () => true,
  canSharePublicly: () => false,
}))
vi.mock('@/lib/products/workspace', () => ({
  loadProductWorkspace: mocks.loadProductWorkspace,
  parseProductHistoryCursor: mocks.parseProductHistoryCursor,
}))
vi.mock('@/lib/improvements/service', () => ({
  recordRecommendedImprovements: mocks.recordRecommendedImprovements,
}))
vi.mock('@/components/product/ProductWorkspace', () => ({
  ProductWorkspace: ({
    workspace,
    onAttentionVisible,
  }: {
    workspace: { product: { id: string } }
    onAttentionVisible?: () => Promise<void>
  }) => (
    <div data-testid="product-workspace">
      {workspace.product.id}
      {onAttentionVisible ? (
        <button type="button" onClick={() => void onAttentionVisible()}>
          Record visible Attention
        </button>
      ) : null}
    </div>
  ),
}))

describe('/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAppViewer.mockResolvedValue({ user: { id: 'owner-1' } })
    mocks.loadProductWorkspace.mockResolvedValue({
      product: { id: 'product-1' },
      attention: [],
    })
    mocks.parseProductHistoryCursor.mockReturnValue(null)
    mocks.recordRecommendedImprovements.mockResolvedValue(undefined)
  })

  it('loads the owner-scoped Product workspace with explicit entitlements', async () => {
    render(await ProductPage({ params: Promise.resolve({ id: 'product-1' }) }))

    expect(screen.getByTestId('product-workspace')).toHaveTextContent(
      'product-1',
    )
    expect(mocks.loadProductWorkspace).toHaveBeenCalledWith(
      'product-1',
      'owner-1',
      {
        signalsEligible: true,
        canDailyWatch: false,
        historyCursor: null,
      },
    )
  })

  it('passes a validated date-and-ID history cursor into the owner-scoped loader', async () => {
    const cursor = {
      at: '2026-08-13T00:00:00.000Z',
      id: 'review:review-1',
    }
    mocks.parseProductHistoryCursor.mockReturnValue(cursor)

    render(
      await ProductPage({
        params: Promise.resolve({ id: 'product-1' }),
        searchParams: Promise.resolve({
          historyCursor: `${cursor.at}|${cursor.id}`,
        }),
      }),
    )

    expect(mocks.parseProductHistoryCursor).toHaveBeenCalledWith(
      `${cursor.at}|${cursor.id}`,
    )
    expect(mocks.loadProductWorkspace).toHaveBeenCalledWith(
      'product-1',
      'owner-1',
      expect.objectContaining({ historyCursor: cursor }),
    )
  })

  it('records only the delivered owner Attention after the client reports visibility', async () => {
    mocks.loadProductWorkspace.mockResolvedValue({
      product: { id: 'product-1' },
      attention: [{ id: 'improvement-1' }, { id: 'improvement-2' }],
    })

    render(await ProductPage({ params: Promise.resolve({ id: 'product-1' }) }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Record visible Attention' }),
    )

    await waitFor(() => {
      expect(mocks.recordRecommendedImprovements).toHaveBeenCalledWith({
        projectId: 'product-1',
        userId: 'owner-1',
        improvementIds: ['improvement-1', 'improvement-2'],
      })
    })
  })

  it('redirects an unauthenticated viewer before loading Product data', async () => {
    mocks.getAppViewer.mockResolvedValue(null)

    await expect(
      ProductPage({ params: Promise.resolve({ id: 'product-1' }) }),
    ).rejects.toThrow('REDIRECT:/sign-in')
    expect(mocks.loadProductWorkspace).not.toHaveBeenCalled()
  })

  it('uses the route not-found state for a missing owner-scoped Product', async () => {
    mocks.loadProductWorkspace.mockResolvedValue(null)

    await expect(
      ProductPage({ params: Promise.resolve({ id: 'missing' }) }),
    ).rejects.toThrow('NOT_FOUND')
  })
})
