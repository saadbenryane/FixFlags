import { describe, expect, it, vi } from 'vitest'
import {
  assertCanCreateProduct,
  ProductLimitReached,
} from '@/lib/billing/product-capacity'

function client(plan: 'FREE' | 'BUILDER' | 'TEAM', count: number) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    user: { findUnique: vi.fn().mockResolvedValue({ plan }) },
    project: { count: vi.fn().mockResolvedValue(count) },
  }
}

describe('Product capacity', () => {
  it('blocks a second Product on Free', async () => {
    const tx = client('FREE', 1)
    await expect(assertCanCreateProduct(tx as never, 'user-1')).rejects.toEqual(
      new ProductLimitReached(1)
    )
  })

  it('blocks a sixth Product on Pro', async () => {
    const tx = client('BUILDER', 5)
    await expect(assertCanCreateProduct(tx as never, 'user-1')).rejects.toEqual(
      new ProductLimitReached(5)
    )
  })

  it('does not count Products for Studio', async () => {
    const tx = client('TEAM', 500)
    await expect(assertCanCreateProduct(tx as never, 'user-1')).resolves.toBeUndefined()
    expect(tx.project.count).not.toHaveBeenCalled()
  })
})
