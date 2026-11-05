import { BlockList, isIP } from 'node:net'

function subnets(family: 'ipv4' | 'ipv6', ranges: readonly string[]) {
  const list = new BlockList()
  for (const range of ranges) {
    const [address, prefix] = range.split('/')
    list.addSubnet(address, Number(prefix), family)
  }
  return list
}

// IANA special-purpose registries: globally reachable exceptions are handled
// separately. CIDRs must not exclude the ordinary public networks around them.
const nonPublicV4 = subnets('ipv4', [
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12',
  '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15',
  '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4',
])
const globalV6 = subnets('ipv6', ['2000::/3'])
const nonPublicV6 = subnets('ipv6', ['2001::/23', '2001:db8::/32', '3fff::/20'])
const globalV6Exceptions = subnets('ipv6', [
  '2001:1::1/128', '2001:1::2/128', '2001:1::3/128', '2001:3::/32', '2001:4:112::/48',
  '2001:20::/28', '2001:30::/28',
])

function publicV4(address: string) {
  return address === '192.0.0.9' || address === '192.0.0.10' || !nonPublicV4.check(address, 'ipv4')
}

/** Canonicalize an already validated IPv6 literal before reading embedded IPv4.
 * WHATWG URL parsing also converts dotted tails into hexadecimal words. */
function ipv6Words(address: string) {
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1)
  const [left, right] = canonical.split('::')
  const head = left ? left.split(':') : [], tail = right ? right.split(':') : []
  const words = right === undefined ? head : [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail]
  return { canonical, words: words.map(word => Number.parseInt(word, 16)) }
}

function embeddedV4(high: number, low: number) {
  return `${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`
}

/** Eligibility for public transport, never proof that an address is reachable. */
export function isPublicIp(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return publicV4(address)
  if (family !== 6 || address.includes('%')) return false
  const { canonical, words } = ipv6Words(address)
  const mapped = words.slice(0, 5).every(word => word === 0) && words[5] === 0xffff
  const nat64 = words[0] === 0x64 && words[1] === 0xff9b && words.slice(2, 6).every(word => word === 0)
  if (mapped || nat64) return publicV4(embeddedV4(words[6], words[7]))
  // Translation and tunnels cannot conceal private IPv4 endpoints. Preserve
  // public embeddings without treating the outer IPv6 prefix as sufficient.
  if (words[0] === 0x2002) return publicV4(embeddedV4(words[1], words[2]))
  if (words[0] === 0x2001 && words[1] === 0)
    return publicV4(embeddedV4(words[2], words[3])) && publicV4(embeddedV4(words[6] ^ 0xffff, words[7] ^ 0xffff))
  return globalV6.check(canonical, 'ipv6') && (!nonPublicV6.check(canonical, 'ipv6') || globalV6Exceptions.check(canonical, 'ipv6'))
}
