import { describe, expect, it, vi, beforeEach } from 'vitest'
import ProductPage from '@/app/(app)/products/[id]/page'

const mocks = vi.hoisted(() => ({
  getAppViewer: vi.fn(),
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

describe('/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAppViewer.mockResolvedValue({ user: { id: 'owner-1' } })
  })

  it('redirects an unauthenticated viewer to sign-in', async () => {
    mocks.getAppViewer.mockResolvedValue(null)
    await expect(
      ProductPage({ params: Promise.resolve({ id: 'product-1' }) })
    ).rejects.toThrow('REDIRECT:/sign-in')
  })

  it('redirects an owned Product id onto the Site board', async () => {
    await expect(
      ProductPage({ params: Promise.resolve({ id: 'product-1' }) })
    ).rejects.toThrow('REDIRECT:/sites/product-1')
  })

  it('uses not-found when the id is empty', async () => {
    await expect(
      ProductPage({ params: Promise.resolve({ id: '' }) })
    ).rejects.toThrow('NOT_FOUND')
  })
})
