import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
const transaction = vi.hoisted(() => vi.fn())
vi.mock('@/lib/audit/execution-ownership', () => ({ executionTransaction: transaction }))
import { productTransaction } from '@/lib/billing/product-transaction'

const conflict = () => new Prisma.PrismaClientKnownRequestError('Concurrent admission', { code: 'P2034', clientVersion: 'test' })
describe('concurrent Site admission', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0) })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
  it('retries a serialization conflict with a fresh admission transaction', async () => {
    transaction.mockReset().mockRejectedValueOnce(conflict()).mockResolvedValueOnce('site')
    const admission = vi.fn()
    const started = Date.now()
    const result = productTransaction(admission)
    await vi.runAllTimersAsync()
    await expect(result).resolves.toBe('site')
    expect(Date.now() - started).toBe(25)
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
    const started = Date.now()
    const failed = expect(productTransaction(vi.fn())).rejects.toMatchObject({ name: 'ProductAdmissionBusy', code: 'ADMISSION_BUSY', cause: { code: 'P2034' } })
    await vi.runAllTimersAsync()
    await failed
    expect(Date.now() - started).toBe(375)
    expect(transaction).toHaveBeenCalledTimes(5)
  })
  it.each(['P2002', 'P2028'])('never retries an unrelated database error: %s', async code => {
    const error = new Prisma.PrismaClientKnownRequestError('Other failure', { code, clientVersion: 'test' })
    transaction.mockReset().mockRejectedValue(error)
    await expect(productTransaction(vi.fn())).rejects.toBe(error)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

})
