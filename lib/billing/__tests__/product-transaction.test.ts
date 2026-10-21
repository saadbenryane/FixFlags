import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
const transaction = vi.hoisted(() => vi.fn())
vi.mock('@/lib/audit/execution-ownership', () => ({ executionTransaction: transaction }))
import { productTransaction } from '@/lib/billing/product-transaction'

const conflict = () => new Prisma.PrismaClientKnownRequestError('Concurrent admission', { code: 'P2034', clientVersion: 'test' })
describe('concurrent Site admission', () => {
  beforeEach(() => { transaction.mockReset() })
  afterEach(() => { vi.restoreAllMocks() })
  it('admits through one serializable execution transaction', async () => {
    transaction.mockResolvedValueOnce('site')
    const admission = vi.fn()
    await expect(productTransaction(admission)).resolves.toBe('site')
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(transaction).toHaveBeenCalledWith(admission, { isolationLevel: 'Serializable' })
  })
  it('does not retry a capacity refusal or other application error', async () => {
    const error = new Error('One website during open beta')
    transaction.mockRejectedValue(error)
    await expect(productTransaction(vi.fn())).rejects.toBe(error)
    expect(transaction).toHaveBeenCalledTimes(1)
  })
  it('reports admission busy when the shared transaction retry is exhausted', async () => {
    transaction.mockRejectedValue(conflict())
    await expect(productTransaction(vi.fn())).rejects.toMatchObject({ name: 'ProductAdmissionBusy', code: 'ADMISSION_BUSY', cause: { code: 'P2034' } })
    expect(transaction).toHaveBeenCalledTimes(1)
  })
  it.each(['P2002', 'P2028'])('never treats an unrelated database error as admission contention: %s', async code => {
    const error = new Prisma.PrismaClientKnownRequestError('Other failure', { code, clientVersion: 'test' })
    transaction.mockRejectedValue(error)
    await expect(productTransaction(vi.fn())).rejects.toBe(error)
    expect(transaction).toHaveBeenCalledTimes(1)
  })

})
