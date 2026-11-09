type Policy = Map<string, string[]>
const trim = (value: string) => value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')
const NONCE_OR_HASH = /^'(?:nonce-[a-z0-9+/_-]+={0,2}|sha(?:256|384|512)-[a-z0-9+/_-]+={0,2})'$/i

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
    !list.some(value => NONCE_OR_HASH.test(value))
}
function ancestorRestriction(list: string[]): boolean | null {
  if (!list.length) return true
  const sources = list.map(value => value.toLowerCase())
  if (sources.some(value => value === '*' || /^https?:$/.test(value) || /^(?:https?:)?\/\/\*(?::(?:\*|80|443))?\/?$/.test(value))) return false
  return sources.every(value => ["'self'", "'none'"].includes(value) ||
    /^(?:https?:\/\/)?(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::(?:\d+|\*))?(?:\/[^;,\s]*)?$/.test(value)) ? true : null
}

const SCHEME_SOURCE = /^[a-z][a-z0-9+.-]*:$/i
const HOST_SOURCE = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(\*|(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*)(?::(\d+|\*))?(?:\/(?:[a-z0-9._~!$&'()*+\-=:@/]|%[0-9a-f]{2})*)?$/i
const NON_OBJECT_KEYWORDS = new Set(["'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", "'unsafe-hashes'", "'strict-dynamic'", "'report-sample'"])
const broadWebSource = (value: string) => ['*', 'http:', 'https:'].includes(value)
const URL_SOURCE_DIRECTIVES = new Set(['base-uri', 'child-src', 'connect-src', 'fenced-frame-src', 'font-src', 'form-action',
  'frame-ancestors', 'frame-src', 'img-src', 'manifest-src', 'media-src', 'object-src', 'worker-src'])
const CODE_SOURCE_DIRECTIVES = new Set(['default-src', 'script-src', 'script-src-attr', 'script-src-elem', 'style-src', 'style-src-attr', 'style-src-elem'])

function sourceHost(value: string) {
  const [, host, port] = HOST_SOURCE.exec(value) ?? []
  return port && port !== '*' && Number(port) > 65_535 ? undefined : host
}

function isUrlSource(value: string) {
  return ["'none'", "'self'"].includes(value.toLowerCase()) || SCHEME_SOURCE.test(value) || Boolean(sourceHost(value))
}

function validSandboxTokens(tokens: string[]) {
  return tokens.every(token => !/[^!-~]/.test(token))
}

function recognizedEnforcingDirective(name: string, values: string[]) {
  if (URL_SOURCE_DIRECTIVES.has(name)) return !values.length || values.some(isUrlSource)
  if (CODE_SOURCE_DIRECTIVES.has(name)) return !values.length || values.some(value =>
    isUrlSource(value) || NON_OBJECT_KEYWORDS.has(value.toLowerCase()) || NONCE_OR_HASH.test(value))
  if (name === 'sandbox') return validSandboxTokens(values)
  if (name === 'upgrade-insecure-requests') return !values.length
  if (name === 'require-trusted-types-for') return values.includes("'script'")
  if (name === 'trusted-types') return values.every(value => /^(?:[a-z0-9#=_/@.%-]+|\*|'none'|'allow-duplicates')$/i.test(value))
  return false
}

function enforcementDeclaration(parsed: Policy[]): boolean | null {
  let unsupported = false
  for (const policy of parsed) for (const [name, values] of policy) {
    if (name === 'report-uri' || name === 'report-to') continue
    if (name === 'trusted-types' && values.includes('*') && values.includes("'allow-duplicates'")) continue
    if (recognizedEnforcingDirective(name, values)) return true
    unsupported = true
  }
  return unsupported ? null : false
}

function objectSourceList(list: string[]) {
  const broad: string[] = []
  let incomplete = false
  for (const value of list) {
    const keyword = value.toLowerCase()
    if (keyword === "'none'" || keyword === "'self'" || NON_OBJECT_KEYWORDS.has(keyword) || NONCE_OR_HASH.test(value)) continue
    const host = sourceHost(value)
    if (SCHEME_SOURCE.test(value)) broad.push(keyword)
    else if (host === '*') broad.push(value)
    else if (!host) incomplete = true
  }
  return { broad, incomplete }
}

function objectSourcesRestricted(parsed: Policy[]): boolean | null {
  const observed = parsed.map(policy => source(policy, ['object-src', 'default-src']))
    .filter((list): list is string[] => list !== undefined).map(objectSourceList)
  const [first, ...other] = observed
  if (!first) return false
  if (observed.some(list => !list.incomplete && !list.broad.length)) return true
  // One shared broad source is enough to establish the gap. The plain web
  // sources all admit HTTPS. Other intersections can be disjoint.
  if (first.broad.some(value => other.every(list => list.broad.includes(value))) ||
      observed.every(list => list.broad.some(broadWebSource))) return false
  return null
}

/** Bounded conclusions about published directives, not general CSP assurance. */
export function inspectCsp(header: string) {
  const parsed = policies(header)
  const sandboxes = parsed.flatMap(policy => {
    const tokens = policy.get('sandbox')
    if (!tokens) return []
    return [validSandboxTokens(tokens) ? tokens.some(token => token.toLowerCase() === 'allow-scripts') : null]
  })
  // Chromium intersects sandbox flags, while HTML selects the last directive.
  const sandboxUncertain = sandboxes.includes(null) || (sandboxes.includes(false) && sandboxes.includes(true))
  const sandboxBlocksScripts = !sandboxUncertain && sandboxes.includes(false)
  const effectivePermission = (allowed: boolean | null) =>
    sandboxBlocksScripts ? false : sandboxUncertain && allowed ? null : allowed
  const elements = permission(parsed.map(policy => source(policy, ['script-src-elem', 'script-src', 'default-src'])), arbitraryInline)
  const attributes = permission(parsed.map(policy => source(policy, ['script-src-attr', 'script-src', 'default-src'])), arbitraryInline)
  const inlineAllowed = elements === true || attributes === true ? true : elements === false && attributes === false ? false : null
  const evalAllowed = permission(parsed.map(policy => source(policy, ['script-src', 'default-src'])), list =>
    list.some(value => value.toLowerCase() === "'unsafe-eval'"))
  const objectRestricted = objectSourcesRestricted(parsed)
  const ancestors = parsed.filter(policy => policy.has('frame-ancestors')).map(policy => ancestorRestriction(policy.get('frame-ancestors')!))
  const frameProtected = ancestors.includes(true) ? true : ancestors.length && ancestors.every(value => value === false) ? false : null
  return { enforcement: enforcementDeclaration(parsed), sandboxBlocksScripts, sandboxUncertain,
    inlineAllowed: effectivePermission(inlineAllowed), evalAllowed: effectivePermission(evalAllowed),
    objectRestricted, hasFrameAncestors: ancestors.length > 0, frameProtected }
}
