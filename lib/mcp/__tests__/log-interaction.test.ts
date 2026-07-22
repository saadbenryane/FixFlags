import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  extractAuditIdFromToolResult,
  extractMcpLogMetadata,
  parseJsonRpcResponseOutcome,
  parseMcpRequestSummary,
  resolveInteractionAuditId,
} from '@/lib/mcp/log-interaction'

describe('parseMcpRequestSummary', () => {
  it('extracts method, tool, and audit id from tools/call', () => {
    const summary = parseMcpRequestSummary({
      method: 'tools/call',
      params: {
        name: 'ff_get_report',
        arguments: { reportId: 'audit-123' },
      },
    })
    assert.equal(summary.method, 'tools/call')
    assert.equal(summary.tool, 'ff_get_report')
    assert.equal(summary.auditIdFromParams, 'audit-123')
  })

  it('returns unknown method when body is invalid', () => {
    const summary = parseMcpRequestSummary(null)
    assert.equal(summary.method, 'unknown')
    assert.equal(summary.tool, null)
  })
})

describe('parseJsonRpcResponseOutcome', () => {
  it('marks JSON-RPC error responses as failures', () => {
    const outcome = parseJsonRpcResponseOutcome({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Invalid API key' },
      id: 1,
    })
    assert.equal(outcome.success, false)
    assert.equal(outcome.errorCode, 'Invalid API key')
  })

  it('marks successful JSON-RPC responses as success', () => {
    const outcome = parseJsonRpcResponseOutcome({
      jsonrpc: '2.0',
      result: { content: [] },
      id: 1,
    })
    assert.equal(outcome.success, true)
  })
})

describe('extractAuditIdFromToolResult', () => {
  it('reads reportId from ff_check_and_plan JSON text content', () => {
    const auditId = extractAuditIdFromToolResult(
      'ff_check_and_plan',
      JSON.stringify({ reportId: 'new-audit-1', status: 'QUEUED' })
    )
    assert.equal(auditId, 'new-audit-1')
  })

  it('reads parentReportId from tool params shape', () => {
    const auditId = extractAuditIdFromToolResult('ff_recheck_and_compare', {
      parentReportId: 'parent-9',
    })
    assert.equal(auditId, 'parent-9')
  })

  it('reads repo scan ids from repo MCP tool results', () => {
    const auditId = extractAuditIdFromToolResult(
      'ff_start_repo_scan',
      JSON.stringify({ repoScanId: 'repo-scan-123', status: 'QUEUED' })
    )
    assert.equal(auditId, 'repo-scan-123')
  })
})

describe('extractMcpLogMetadata', () => {
  it('captures jsonrpc id, http status, and queue hints', () => {
    const metadata = extractMcpLogMetadata(
      {
        jsonrpc: '2.0',
        id: 42,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                queued: true,
                queueReason: 'backlog',
                estimatedWaitSeconds: 30,
                queuePosition: 2,
              }),
            },
          ],
        },
      },
      200
    )
    assert.equal((metadata as { httpStatus: number }).httpStatus, 200)
    assert.equal((metadata as { jsonRpcId: number }).jsonRpcId, 42)
    assert.equal((metadata as { queued: boolean }).queued, true)
    assert.equal((metadata as { queueReason: string }).queueReason, 'backlog')
  })
})

describe('resolveInteractionAuditId', () => {
  it('prefers audit id from tool result over params', () => {
    assert.equal(resolveInteractionAuditId('param-id', 'result-id'), 'result-id')
  })

  it('falls back to params when result has no id', () => {
    assert.equal(resolveInteractionAuditId('param-id', null), 'param-id')
  })
})
