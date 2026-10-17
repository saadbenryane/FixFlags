import { describe, expect, it } from 'vitest'
import { serializeArtifact } from '../contracts'
import { prescriptionSettlement, summedPrescriptionUsage } from '../incomplete'

describe('prescription settlement', () => {
  it('leaves the audit unchanged while any prescription task is still open', () => {
    expect(prescriptionSettlement([])).toEqual({ kind: 'open' })
    expect(prescriptionSettlement([
      { workState: 'COMPLETED', workErrorCode: null },
      { workState: 'RUNNING', workErrorCode: null },
    ])).toEqual({ kind: 'open' })
    expect(prescriptionSettlement([{ workState: 'RETRY_WAIT', workErrorCode: 'WORKER_INTERRUPTED' }])).toEqual({ kind: 'open' })
  })

  it('records completion only when every prescription task completed', () => {
    expect(prescriptionSettlement([
      { workState: 'COMPLETED', workErrorCode: null },
      { workState: 'COMPLETED', workErrorCode: null },
    ])).toEqual({ kind: 'complete' })
  })

  it('keeps a contract failure distinct from other terminal prescription failures', () => {
    expect(prescriptionSettlement([
      { workState: 'COMPLETED', workErrorCode: null },
      { workState: 'BLOCKED', workErrorCode: 'AI_CONTRACT_INVALID' },
    ])).toEqual({ kind: 'failed', failureCode: 'AI_CONTRACT_INVALID', reason: 'AI_CONTRACT_INVALID' })
    expect(prescriptionSettlement([
      { workState: 'EXHAUSTED', workErrorCode: 'RECOVERY_EXHAUSTED' },
    ])).toEqual({ kind: 'failed', failureCode: 'AI_REVIEW_FAILED', reason: 'RECOVERY_EXHAUSTED' })
    expect(prescriptionSettlement([
      { workState: 'BLOCKED', workErrorCode: 'PRESCRIPTION_PRIMARY_METADATA_MISSING' },
    ])).toEqual({ kind: 'failed', failureCode: 'AI_REVIEW_FAILED', reason: 'PRESCRIPTION_PRIMARY_METADATA_MISSING' })
  })

  it('sums measured usage after every task is terminal and ignores a legacy artifact', () => {
    const measured = (inputTokens: number, outputTokens: number, extra: Record<string, number | string> = {}) =>
      serializeArtifact('prescription', { completed: true, inputTokens, outputTokens, model: 'controlled', ...extra })
    expect(summedPrescriptionUsage([
      { workState: 'COMPLETED', workResult: measured(2, 3) },
      { workState: 'RUNNING', workResult: measured(9, 9) },
    ])).toBeNull()
    expect(summedPrescriptionUsage([
      { workState: 'COMPLETED', workResult: serializeArtifact('prescription', { completed: true }) },
    ])).toBeNull()
    expect(summedPrescriptionUsage([
      { workState: 'COMPLETED', workResult: measured(0, 0) },
    ])).toBeNull()
    expect(summedPrescriptionUsage([
      { workState: 'COMPLETED', workResult: measured(2, 3, { cacheReadTokens: 4 }) },
      { workState: 'BLOCKED', workResult: null },
      { workState: 'COMPLETED', workResult: measured(5, 6, { cacheWriteTokens: 1 }) },
    ])).toEqual({ inputTokens: 7, outputTokens: 9, cacheReadTokens: 4, cacheWriteTokens: 1, model: 'controlled' })
  })
})
