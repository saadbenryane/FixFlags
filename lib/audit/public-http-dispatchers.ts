import type { LookupFunction } from 'node:net'
import { Agent } from 'undici'

type Owner = { lookup: LookupFunction; pending: number; cancellation: AbortController; dnsFailure?: Error }

/** One admitted operation owns a slot at a time. Its healthy connections can
 * be reused, while DNS state and cancellation never belong to another request. */
class HttpSlot {
  owner?: Owner
  readonly dispatcher = new Agent({ connect: { rejectUnauthorized: true,
    lookup: (hostname, options, callback) => {
      const owner = this.owner
      if (!owner) { callback(new Error('HTTP connection has no active owner'), ''); return }
      owner.pending++
      owner.lookup(hostname, options, (error, addresses, family) => {
        owner.pending--
        owner.dnsFailure = error ?? undefined
        callback(error, addresses, family)
      })
    },
  } })
}

export function createPublicHttpDispatchers(createLookup: (signal: AbortSignal) => LookupFunction) {
  const idle: HttpSlot[] = []
  return {
    /** The caller holds the existing HTTP capacity permit for this whole lease.
     * This pool has no second queue or independent concurrency allowance. */
    lease(signal: AbortSignal) {
      const slot = idle.pop() ?? new HttpSlot()
      const cancellation = new AbortController()
      const owner: Owner = { cancellation, pending: 0, lookup: createLookup(AbortSignal.any([signal, cancellation.signal])) }
      slot.owner = owner
      let released = false
      return {
        dispatcher: slot.dispatcher,
        get resolvingDns() { return owner.pending > 0 },
        get dnsFailure() { return owner.dnsFailure },
        async release() {
          if (released) return
          released = true
          const reusable = !signal.aborted && owner.pending === 0
          owner.cancellation.abort(new Error('HTTP connection ownership ended'))
          slot.owner = undefined
          if (reusable) idle.push(slot)
          else await slot.dispatcher.destroy()
        },
      }
    },
  }
}
