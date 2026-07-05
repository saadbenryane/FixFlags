import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { buildReportMcpCommand } from '@/lib/mcp/report-command-copy'

describe('buildReportMcpCommand', () => {
  it('uses MCP tools/call shape instead of direct tool names as JSON-RPC methods', () => {
    const command = buildReportMcpCommand('audit-123', 'https://fixflags.test')

    assert.match(command, /https:\/\/fixflags\.test\/api\/mcp/)
    assert.match(command, /Report ID: audit-123/)
    assert.match(command, /"method":"tools\/call"/)
    assert.match(command, /"name":"ff_get_report"/)
    assert.match(command, /"arguments":\{"reportId":"audit-123"\}/)
    assert.doesNotMatch(command, /"method":"ff_get_report"/)
  })

  it('tells agents to fetch rubric and flag details before editing', () => {
    const command = buildReportMcpCommand('audit-456', 'https://fixflags.test')

    assert.match(command, /ff_get_rubric/)
    assert.match(command, /MESSAGE/)
    assert.match(command, /EXPERIENCE/)
    assert.match(command, /REACH/)
    assert.match(command, /ff_get_flag/)
    assert.match(command, /before editing/i)
  })
})
