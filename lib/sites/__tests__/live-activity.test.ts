import { describe, expect, it } from 'vitest'
import { liveActivityLine } from '../live-activity'

describe('live activity line', () => {
  it('says what the first running task is trying, on which page and device', () => {
    expect(liveActivityLine([
      { kind: 'http', pageUrl: 'https://shop.com/', state: 'COMPLETED' },
      { kind: 'flow', pageUrl: 'https://shop.com/pricing?ref=1', state: 'RUNNING', device: 'mobile' },
    ])).toBe('Trying the main button on /pricing (mobile)')
  })

  it('counts other running tasks and falls back for unknown kinds', () => {
    expect(liveActivityLine([
      { kind: 'new-kind', pageUrl: 'https://shop.com/cart', state: 'RUNNING' },
      { kind: 'http', pageUrl: 'https://shop.com/', state: 'RUNNING' },
      { kind: 'http', pageUrl: 'https://shop.com/a', state: 'RUNNING' },
    ])).toBe('Checking /cart, and 2 more')
  })

  it('is empty when nothing is running', () => {
    expect(liveActivityLine([{ kind: 'http', pageUrl: 'https://shop.com/', state: 'WAITING' }])).toBeNull()
    expect(liveActivityLine(null)).toBeNull()
  })
})
