import { describe, expect, it } from 'vitest'
import { shareStatusMessage } from '@/lib/audit/share-status'

describe('shareStatusMessage', () => {
  it('encourages sharing when no critical flags remain', () => {
    expect(shareStatusMessage('good_to_share')).toContain('Good to share')
  })

  it('warns before sharing while critical flags remain', () => {
    expect(shareStatusMessage('fix_first')).toContain('Fix critical Flags before sharing')
  })
})
