import { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const transaction = vi.hoisted(() => vi.fn())
const findTask = vi.hoisted(() => vi.fn())
const releaseTask = vi.hoisted(() => vi.fn(async () => ({ count: 0 })))
vi.mock('@/lib/db', () => ({ prisma: {
  $transaction: transaction,
  auditVerifierExecution: { findFirst: findTask, updateMany: releaseTask },
  audit: { findFirst: vi.fn(), updateMany: vi.fn(async () => ({ count: 0 })) },
} }))

import { currentExecutionOwnership, executionTransaction, ExecutionOwnershipLost, withExecutionOwnership } from '@/lib/audit/execution-ownership'

const conflict = () => new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict or a deadlock. Please retry your transaction.', { code: 'P2034', clientVersion: 'test' })

describe('execution transaction conflicts', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0) })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('retries a write conflict on a fresh transaction', async () => {
    transaction.mockReset().mockRejectedValueOnce(conflict()).mockImplementationOnce(async (work: (tx: { $queryRaw: () => Promise<unknown> }) => Promise<unknown>) => work({ $queryRaw: async () => [] }))
    const write = vi.fn(async () => 'saved')
    const started = Date.now()
    const result = executionTransaction(write, { isolationLevel: 'Serializable' })
    await vi.runAllTimersAsync()
    await expect(result).resolves.toBe('saved')
    expect(Date.now() - started).toBe(25)
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('retries an expired transaction instead of discarding the observation', async () => {
    const expired = new Prisma.PrismaClientKnownRequestError('Transaction already closed: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 5200 ms passed since the start of the transaction.', { code: 'P2028', clientVersion: 'test' })
    transaction.mockReset().mockRejectedValueOnce(expired).mockImplementationOnce(async (work: (tx: { $queryRaw: () => Promise<unknown> }) => Promise<unknown>) => work({ $queryRaw: async () => [] }))
    const write = vi.fn(async () => 'saved')
    const result = executionTransaction(write)
    await vi.runAllTimersAsync()
    await expect(result).resolves.toBe('saved')
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), undefined)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('retries a connector deadlock without treating it as a committed write', async () => {
    const locked = new Error('Raw query failed. Code: `40P01`. Message: `ERROR: deadlock detected`')
    transaction.mockReset().mockRejectedValueOnce(locked).mockImplementationOnce(async (work: (tx: { $queryRaw: () => Promise<unknown> }) => Promise<unknown>) => work({ $queryRaw: async () => [] }))
    const result = executionTransaction(async () => 'saved')
    await vi.runAllTimersAsync()
    await expect(result).resolves.toBe('saved')
    expect(transaction).toHaveBeenCalledTimes(2)
  })

  it('retries a connector lock timeout without treating it as a committed write', async () => {
    const locked = new Error('ConnectorError(PostgresError { code: "55P03", message: "canceling statement due to lock timeout" })')
    transaction.mockReset().mockRejectedValueOnce(locked).mockImplementationOnce(async (work: (tx: { $queryRaw: () => Promise<unknown> }) => Promise<unknown>) => work({ $queryRaw: async () => [] }))
    const result = executionTransaction(async () => 'saved')
    await vi.runAllTimersAsync()
    await expect(result).resolves.toBe('saved')
    expect(transaction).toHaveBeenCalledTimes(2)
  })

  it.each(['40001', '40P01'])('retries the whole transaction for raw SQLSTATE %s', async code => {
    const aborted = new Prisma.PrismaClientKnownRequestError('Raw query failed', {
      code: 'P2010', clientVersion: 'test', meta: { code },
    })
    transaction.mockReset().mockImplementationOnce(async (write: () => Promise<unknown>) => { await write(); throw aborted })
      .mockImplementationOnce(async (write: () => Promise<unknown>) => write())
    const write = vi.fn(async () => 'saved')
    const result = executionTransaction(write, { isolationLevel: 'Serializable' })
    await vi.runAllTimersAsync()
    await expect(result).resolves.toBe('saved')
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('bounds retries of raw serialization conflicts', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Raw query failed', { code: 'P2010', clientVersion: 'test', meta: { code: '40001' } })
    transaction.mockReset().mockRejectedValue(error)
    const failed = expect(executionTransaction(vi.fn())).rejects.toBe(error)
    await vi.runAllTimersAsync()
    await failed
    expect(transaction).toHaveBeenCalledTimes(5)
  })

  it('does not repeat raw SQL with an unrelated SQLSTATE', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Raw query failed', { code: 'P2010', clientVersion: 'test', meta: { code: '23505' } })
    transaction.mockReset().mockRejectedValue(error)
    await expect(executionTransaction(vi.fn())).rejects.toBe(error)
    expect(transaction).toHaveBeenCalledTimes(1)
  })

  it('does not repeat an interactive timeout after a second attempt', async () => {
    const expired = new Prisma.PrismaClientKnownRequestError('Transaction already closed: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 5200 ms passed since the start of the transaction.', { code: 'P2028', clientVersion: 'test' })
    transaction.mockReset().mockRejectedValue(expired)
    const started = Date.now()
    const failed = expect(executionTransaction(vi.fn())).rejects.toBe(expired)
    await vi.runAllTimersAsync()
    await failed
    expect(Date.now() - started).toBe(25)
    expect(transaction).toHaveBeenCalledTimes(2)
  })

  it.each(['P2028', 'P2034'])('returns the database error after five aborted transactions: %s', async code => {
    transaction.mockReset().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('aborted', { code, clientVersion: 'test' }))
    const started = Date.now()
    const failed = expect(executionTransaction(vi.fn())).rejects.toMatchObject({ code })
    await vi.runAllTimersAsync()
    await failed
    expect(Date.now() - started).toBe(375)
    expect(transaction).toHaveBeenCalledTimes(5)
  })

  it('does not retry an unrelated database error: P2002', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Other failure', { code: 'P2002', clientVersion: 'test' })
    transaction.mockReset().mockRejectedValue(error)
    await expect(executionTransaction(vi.fn())).rejects.toBe(error)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('releases in-flight work when the ledger no longer owns the task', async () => {
    findTask.mockReset().mockResolvedValue(null)
    let seen: AbortSignal | undefined
    const running = withExecutionOwnership({ auditId: 'audit', taskId: 'task', token: 'token', generation: 1 }, () => new Promise((_resolve, reject) => {
      seen = currentExecutionOwnership()?.signal
      seen?.addEventListener('abort', () => reject(new ExecutionOwnershipLost()))
    }))
    const released = expect(running).rejects.toBeInstanceOf(ExecutionOwnershipLost)
    await vi.advanceTimersByTimeAsync(1_000)
    await released
    expect(seen?.aborted).toBe(true)
  })

  it('keeps the attempt while the ledger still owns the task', async () => {
    findTask.mockReset().mockResolvedValue({ id: 'task' })
    let seen: AbortSignal | undefined
    const running = withExecutionOwnership({ auditId: 'audit', taskId: 'task', token: 'token', generation: 1 }, async () => {
      seen = currentExecutionOwnership()?.signal
      await new Promise(resolve => setTimeout(resolve, 1_500))
      return 'kept'
    })
    await vi.advanceTimersByTimeAsync(1_500)
    await expect(running).resolves.toBe('kept')
    expect(seen?.aborted).toBe(false)
  })
})
