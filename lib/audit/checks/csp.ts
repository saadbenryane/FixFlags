type Policy = Map<string, string[]>
const trim = (value: string) => value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')

/** CSP3 serialized policies compose by intersection; the first duplicate
 * directive in each policy wins. https://www.w3.org/TR/CSP3/ */
function policies(header: string): Policy[] {
  return header.split(',').filter(value => trim(value)).map(value => {
    const policy: Policy = new Map()
    for (const serialized of value.split(';')) {
      const [rawName, ...sources] = trim(serialized).split(/[\t\n\f\r ]+/), name = rawName.toLowerCase()
      if (/^[a-z0-9-]+$/.test(name) && !policy.has(name)) policy.set(name, sources)
    }
    return policy
  })
}
function source(policy: Policy, names: string[]) {
  return names.map(name => policy.get(name)).find(value => value !== undefined)
}
function permission(lists: Array<string[] | undefined>, allows: (list: string[]) => boolean): boolean | null {
  const observed = lists.filter((list): list is string[] => list !== undefined)
  return observed.length ? observed.every(allows) : null
}
function arbitraryInline(list: string[]) {
  const keywords = list.map(value => value.toLowerCase())
  return keywords.includes("'unsafe-inline'") && !keywords.includes("'strict-dynamic'") &&
    !list.some(value => /^'(?:nonce-[a-z0-9+/_-]+={0,2}|sha(?:256|384|512)-[a-z0-9+/_-]+={0,2})'$/i.test(value))
}
function ancestorRestriction(list: string[]): boolean | null {
  if (!list.length) return true
  const sources = list.map(value => value.toLowerCase())
  if (sources.some(value => value === '*' || /^https?:$/.test(value) || /^(?:https?:)?\/\/\*(?::(?:\*|80|443))?\/?$/.test(value))) return false
  return sources.every(value => ["'self'", "'none'"].includes(value) ||
    /^(?:https?:\/\/)?(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::(?:\d+|\*))?(?:\/[^;,\s]*)?$/.test(value)) ? true : null
}

/** Bounded conclusions about published directives, not general CSP assurance. */
export function inspectCsp(header: string) {
  const parsed = policies(header)
  const elements = permission(parsed.map(policy => source(policy, ['script-src-elem', 'script-src', 'default-src'])), arbitraryInline)
  const attributes = permission(parsed.map(policy => source(policy, ['script-src-attr', 'script-src', 'default-src'])), arbitraryInline)
  const inlineAllowed = elements === true || attributes === true ? true : elements === false && attributes === false ? false : null
  const evalAllowed = permission(parsed.map(policy => source(policy, ['script-src', 'default-src'])), list =>
    list.some(value => value.toLowerCase() === "'unsafe-eval'"))
  const objectRestricted = parsed.some(policy => policy.has('object-src') && !policy.get('object-src')!.some(value => value.includes('*')))
  const ancestors = parsed.filter(policy => policy.has('frame-ancestors')).map(policy => ancestorRestriction(policy.get('frame-ancestors')!))
  const frameProtected = ancestors.includes(true) ? true : ancestors.length && ancestors.every(value => value === false) ? false : null
  return { inlineAllowed, evalAllowed, objectRestricted, hasFrameAncestors: ancestors.length > 0, frameProtected }
}
