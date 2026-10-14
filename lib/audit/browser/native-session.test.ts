import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { childNativeSession } from './native-session'

describe('native embedded request lifetime', () => {
  it('settles pending descendant commands when an ancestor renderer detaches', async () => {
    const parent = Object.assign(new EventEmitter(), { send: vi.fn(async () => ({})) })
    const child = childNativeSession(parent, 'child'), descendant = childNativeSession(child.channel, 'descendant')
    const pending = descendant.channel.send('Runtime.enable').then(() => 'completed', () => 'closed')
    parent.emit('Target.detachedFromTarget', { sessionId: 'child' })
    try {
      expect(await Promise.race([pending, new Promise(resolve => setTimeout(() => resolve('pending'), 50))])).toBe('closed')
      expect(descendant.isClosed()).toBe(true)
      expect(parent.listenerCount('Target.receivedMessageFromTarget')).toBe(0)
    } finally { child.dispose(); descendant.dispose() }
  })
})
