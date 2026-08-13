import { describe, expect, it } from 'vitest'
import { mcpCoreError, mcpStructuredResult } from '@/lib/mcp/contract'

describe('MCP Contract v1 envelopes', () => {
  it('returns equivalent structured and legacy text content', () => {
    const result = mcpStructuredResult({ reportId: 'review-1', status: 'COMPLETED' })
    expect(result.structuredContent).toEqual({ reportId: 'review-1', status: 'COMPLETED' })
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
  })

  it('standardizes recoverable tool failures', () => {
    const result = mcpCoreError(new Error('Report not found'))
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toEqual({
      status: 'ERROR',
      error: {
        code: 'NOT_FOUND',
        message: 'Report not found',
        recoverable: true,
        action: 'check_identifier',
      },
    })
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
  })
})
