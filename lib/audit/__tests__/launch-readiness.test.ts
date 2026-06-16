import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseLaunchReadiness } from '@/lib/audit/launch-readiness'
import { LAUNCH_CHECKLIST_IDS } from '@/lib/audit/rubric'

describe('parseLaunchReadiness', () => {
  it('parses readiness and checklist items', () => {
    const parsed = parseLaunchReadiness({
      readiness: 'fix_first',
      checklist: [
        { id: 'https', label: 'HTTPS enabled', passed: true },
        { id: 'social-preview', label: 'Social preview', passed: false },
      ],
    })
    assert.ok(parsed)
    assert.equal(parsed?.readiness, 'fix_first')
    assert.equal(parsed?.checklist.length, 2)
    assert.equal(parsed?.checklist[0].id, 'https')
  })

  it('returns null for invalid readiness', () => {
    assert.equal(parseLaunchReadiness({ readiness: 'maybe', checklist: [] }), null)
  })

  it('accepts all launch checklist ids from rubric constants', () => {
    const checklist = LAUNCH_CHECKLIST_IDS.map((id) => ({
      id,
      label: id,
      passed: true,
    }))
    const parsed = parseLaunchReadiness({ readiness: 'safe', checklist })
    assert.equal(parsed?.checklist.length, LAUNCH_CHECKLIST_IDS.length)
  })
})
