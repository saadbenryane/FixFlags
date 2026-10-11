import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
const transaction = vi.hoisted(() => vi.fn())
vi.mock('@/lib/audit/execution-ownership', () => ({ executionTransaction: transaction }))
import { productTransaction } from '@/lib/billing/product-transaction'

const conflict = () => new Prisma.PrismaClientKnownRequestError('Concurrent admission', { code: 'P2034', clientVersion: 'test' })
describe('concurrent Site admission', () => {
  it('retries a serialization conflict with a fresh admission transaction', async () => {
    transaction.mockReset().mockRejectedValueOnce(conflict()).mockResolvedValueOnce('site')
    const admission = vi.fn()
    await expect(productTransaction(admission)).resolves.toBe('site')
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(transaction).toHaveBeenLastCalledWith(admission, { isolationLevel: 'Serializable' })
  })
  it('does not retry a capacity refusal or other application error', async () => {
    const error = new Error('One website during open beta')
    transaction.mockReset().mockRejectedValue(error)
    await expect(productTransaction(vi.fn())).rejects.toBe(error)
    expect(transaction).toHaveBeenCalledTimes(1)
  })
  it('bounds retries when contention does not resolve', async () => {
    transaction.mockReset().mockRejectedValue(conflict())
    await expect(productTransaction(vi.fn())).rejects.toMatchObject({ code: 'P2034' })
    expect(transaction).toHaveBeenCalledTimes(3)
  })
})
