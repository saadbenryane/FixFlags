import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { FIX_ACTION_COPY } from '@/lib/audit/fix-action-copy'

describe('fix action copy', () => {
  it('describes the Cursor action as an MCP connection, not prompt delivery', () => {
    assert.equal(FIX_ACTION_COPY.cursorMcpLabel, 'Connect Cursor MCP')
    assert.match(FIX_ACTION_COPY.cursorMcpAriaLabel, /run FixFlags from your editor/)
    assert.doesNotMatch(FIX_ACTION_COPY.cursorMcpLabel, /send/i)
  })
})
