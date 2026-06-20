import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  anchorFromViewportRect,
  flowCheckIdForStatus,
} from '@/lib/audit/flow/flow-evidence'

describe('flow evidence helpers', () => {
  it('maps flow statuses to check ids', () => {
    assert.equal(flowCheckIdForStatus('dead_end'), 'flow-cta-dead-end')
    assert.equal(flowCheckIdForStatus('success'), null)
  })

  it('normalizes viewport rects to evidence anchors', () => {
    const anchor = anchorFromViewportRect(
      { left: 400, top: 300, right: 600, bottom: 360 },
      1280,
      800
    )
    assert.ok(anchor)
    assert.equal(anchor.scope, 'element')
    assert.ok(anchor.x > 0.3 && anchor.x < 0.5)
    assert.ok(anchor.y > 0.3 && anchor.y < 0.5)
  })
})
