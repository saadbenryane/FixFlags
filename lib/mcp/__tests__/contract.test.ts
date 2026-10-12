import { describe, expect, it } from 'vitest'
import { mcpCoreError, mcpStructuredResult } from '@/lib/mcp/contract'
import { RateLimitError } from '@/lib/security/rate-limit'
import { ImprovementAttemptConflict } from '@/lib/improvements/attempt-intent'

describe('MCP Outcome contract envelopes', () => {
  it('returns a changed-fix refusal with a fresh-key recovery action', () => {
    const error = new ImprovementAttemptConflict()
    expect(mcpCoreError(error, { action: 'retry' }).structuredContent).toEqual({ status: 'ERROR', error: {
      code: 'FIX_INTENT_MISMATCH', message: error.message, recoverable: true, action: 'use_new_request_key',
    } })
  })
  it('returns equivalent structured and legacy text content', () => {
    const result = mcpStructuredResult({ runId: 'run-1', status: 'COMPLETED' })
    expect(result.structuredContent).toEqual({ runId: 'run-1', status: 'COMPLETED' })
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
  })

  it('standardizes recoverable tool failures', () => {
    const result = mcpCoreError(new Error('Outcome not found'))
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toEqual({
      status: 'ERROR',
      error: {
        code: 'NOT_FOUND',
        message: 'The requested Site, Outcome, run, or Flag was not found.',
        recoverable: true,
        action: 'check_identifier',
      },
    })
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
  })

  it('tells an agent to wait when interactive verification is rate-limited', () => {
    expect(mcpCoreError(new RateLimitError(3600)).structuredContent).toEqual({
      status: 'ERROR',
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please wait before trying again.',
        recoverable: true,
        action: 'wait_and_retry',
      },
    })
  })

  it('does not expose arbitrary provider or database errors to an MCP client', () => {
    expect(mcpCoreError(new Error('Database URL: postgres://secret')).structuredContent).toEqual({
      status: 'ERROR',
      error: {
        code: 'MCP_TOOL_FAILED',
        message: 'FixFlags could not complete this request. Please retry.',
        recoverable: true,
        action: 'retry',
      },
    })
    expect(mcpCoreError(null).isError).toBe(true)
  })
})
