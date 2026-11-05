type FixtureDns = { resolve4: (hostname: string) => Promise<string[]>; resolve6: (hostname: string) => Promise<string[]>; cancel?: () => void }

/** Preserve the native per-resolver cancellation contract around controlled
 * fixture answers. No real name server supplies these tests' observations. */
export function dnsFixture(dns: FixtureDns) {
  return { ...dns, Resolver: class {
    private readonly pending = new Set<(error: Error) => void>()
    private query(hostname: string, lookup: FixtureDns['resolve4']) {
      return new Promise<string[]>((resolve, reject) => {
        this.pending.add(reject)
        void Promise.resolve().then(() => lookup(hostname)).then(value => {
          this.pending.delete(reject); resolve(value)
        }, error => { this.pending.delete(reject); reject(error) })
      })
    }
    resolve4(hostname: string) { return this.query(hostname, dns.resolve4) }
    resolve6(hostname: string) { return this.query(hostname, dns.resolve6) }
    cancel() {
      dns.cancel?.()
      for (const reject of this.pending) reject(Object.assign(new Error('Fixture DNS cancelled'), { code: 'ECANCELLED' }))
      this.pending.clear()
    }
  } }
}
