import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { originalFixture } from '@/lib/demo/fixtures/original'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'

describe('static sample vs original fixture', () => {
  it('matches demo fixture headline in flag evidence', () => {
    const audit = getStaticSampleAudit()
    const messageFlag = audit.flags.find((f) => f.checkId === 'h1-generic')
    assert.ok(messageFlag)
    assert.ok(messageFlag.evidence?.includes(originalFixture.headline))
  })

  it('uses the demo fixture URL', () => {
    const audit = getStaticSampleAudit()
    assert.ok(audit.url.endsWith('/demo'))
  })
})
