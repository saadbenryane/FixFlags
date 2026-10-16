import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { PAGE_CHECK_DEFINITIONS } from './definitions'
import { destinationContext } from './destination-evidence'
import { inspectCsp } from './csp'
import { parseDictionary, parseItem, Token } from 'structured-headers'

export const SECURITY_HEADER_VERIFICATION_RULE = 'Public response headers: repeat every originally failed header responsibility on the same response URL.'
export const SECURITY_HEADER_LIMITATION = 'Some response header declarations could not be interpreted. Their configuration remains unknown.'
const POLICY_ASSERTIONS_V2 = new Set(['csp-inline-scripts', 'csp-eval', 'csp-objects', 'frame-protection', 'x-content-type-options', 'referrer-policy',
  'hsts-duration', 'hsts-subdomains', 'hsts-preload', 'permissions-policy', 'opener-policy', 'embedder-policy', 'resource-policy'])
/** Older substring and directive-presence observations remain historical,
 * rather than proof under the corrected browser policy interpretation. */
export function currentSecurityHeaderObservation(assertion: Pick<CheckAssertion, 'key' | 'context'>) {
  return !POLICY_ASSERTIONS_V2.has(assertion.key) || assertion.context?.startsWith('security-header:v2:' + assertion.key + ':') === true
}

/** Separators inside quoted HTTP field values do not create policy tokens. */
function headerTokens(value: string, delimiter = ','): string[] {
  const values: string[] = []
  let start = 0, quoted = false, escaped = false
  for (let index = 0; index < value.length; index++) {
    const character = value[index]
    if (quoted && escaped) { escaped = false; continue }
    if (quoted && character === '\\') { escaped = true; continue }
    if (character === '"') quoted = !quoted
    else if (character === delimiter && !quoted) { values.push(value.slice(start, index)); start = index + 1 }
  }
  values.push(value.slice(start))
  return values.map(value => value.replace(/^[\t\n\r ]+|[\t\n\r ]+$/g, ''))
}
const REFERRER_POLICIES = new Set(['no-referrer', 'no-referrer-when-downgrade', 'same-origin', 'origin',
  'strict-origin', 'origin-when-cross-origin', 'strict-origin-when-cross-origin', 'unsafe-url'])

/**
 * Builder / PaaS managed hostnames where response headers like CSP/HSTS are not
 * settable without a custom domain + reverse proxy. Findings here are POLISH
 * with an explicit constraint note rather than CRITICAL conversion blockers.
 */
export const MANAGED_HOST_SUFFIXES = [
  '.lovable.app',
  '.lovableproject.com',
  '.netlify.app',
  '.vercel.app',
  '.web.app',
  '.firebaseapp.com',
  '.pages.dev',
  '.github.io',
  '.herokuapp.com',
  '.railway.app',
  '.onrender.com',
  '.fly.dev',
  '.replit.app',
  '.replit.dev',
  '.bolt.new',
  '.stackblitz.io',
  '.webcontainer.io',
] as const

export function isManagedHostingHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return MANAGED_HOST_SUFFIXES.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
  )
}

function managedHostConstraintNote(hostname: string): string {
  return `Not settable on managed subdomain (${hostname}); requires custom domain + proxy config.`
}

/** RFC 6797 directives share one interpretation for detection and recovery.
 * Unknown extensions are ignored only after their syntax has been checked. */
function inspectHsts(value: string) {
  const token = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
  const quotedString = /^"(?:[\t\x20\x21\x23-\x5b\x5d-\x7e\x80-\xff]|\\[\t\x20-\x7e\x80-\xff])*"$/
  const directives = new Map<string, string | null>()
  for (const part of headerTokens(value, ';')) {
    if (!part) continue
    const separator = part.indexOf('=')
    const name = (separator < 0 ? part : part.slice(0, separator).replace(/[\t ]+$/, '')).toLowerCase()
    if (!token.test(name) || directives.has(name)) return null
    let argument = separator < 0 ? null : part.slice(separator + 1).replace(/^[\t ]+/, '')
    if (argument !== null) {
      if (quotedString.test(argument)) argument = argument.slice(1, -1).replace(/\\([\t\x20-\x7e\x80-\xff])/g, '$1')
      else if (!token.test(argument)) return null
    }
    if (name === 'includesubdomains' && argument !== null) return null
    directives.set(name, argument)
  }
  const duration = directives.get('max-age')
  if (duration == null || !/^\d+$/.test(duration)) return null
  const age = Number(duration)
  if (!Number.isSafeInteger(age)) return null
  return { age, subdomains: age > 0 && directives.has('includesubdomains'), preload: age > 0 && directives.get('preload') === null }
}

/** Permissions-Policy uses RFC 8941 dictionaries, including last-key wins and
 * wildcard tokens inside inner lists. Strings and other features are separate.
 * The parser stays on RFC 8941, matching the browser header's grammar. */
function sensitivePermissionWildcards(value: string): string[] | null {
  try {
    const dictionary = parseDictionary(value)
    const wildcard = (item: unknown) => item instanceof Token && item.toString() === '*'
    return ['camera', 'microphone', 'geolocation'].filter(feature => {
      const member = dictionary.get(feature)?.[0]
      return wildcard(member) || Array.isArray(member) && member.some(([item]) => wildcard(item))
    })
  } catch { return null }
}

function crossOriginPolicyToken(value: string, structured: boolean): string | null {
  if (!structured) return value.replace(/^[\t\n\r ]+|[\t\n\r ]+$/g, '')
  try {
    const [item] = parseItem(value)
    return item instanceof Token ? item.toString() : null
  } catch { return null }
}

/** Explicit observations of the response configuration, before finding rollups. */
export function securityHeaderObservations(url: string, headers: Record<string, string> | null): CheckAssertion[] {
  if (headers === null) return []
  const csp = headers['content-security-policy'], hsts = headers['strict-transport-security']
  const policy = inspectCsp(csp ?? '')
  const hstsPolicy = hsts ? inspectHsts(hsts) : null
  const age = hstsPolicy?.age ?? null
  const hstsComplete = !hsts || hstsPolicy !== null
  const https = url.startsWith('https://')
  const frame = headers['x-frame-options']?.trim().toLowerCase()
  const referrerHeader = headers['referrer-policy']
  const referrer = headerTokens(referrerHeader ?? '').map(token => token.toLowerCase()).filter(token => REFERRER_POLICIES.has(token)).at(-1)
  const permissions = headers['permissions-policy']
  const overbroad = permissions ? sensitivePermissionWildcards(permissions) : []
  const values: CheckAssertion[] = []
  const responseContext = destinationContext(url, url)
  const observe = (key: string, name: string, expected: string, observed: string, passed: boolean, complete = true, advisory = false) => {
    values.push({ key, name, expected, observed, passed: complete && passed, complete,
      ...(advisory ? { disposition: 'observed' as const } : {}),
      context: `security-header:${POLICY_ASSERTIONS_V2.has(key) ? 'v2:' : ''}${key}:${responseContext}` })
  }
  observe('content-security-policy', 'Content Security Policy', 'An enforcing CSP header is present', csp ? 'Enforcing CSP recorded' : 'Enforcing CSP absent', Boolean(csp))
  observe('csp-inline-scripts', 'CSP inline script permissions', 'Enforced policies restrict arbitrary inline scripts and handlers',
    policy.inlineAllowed === null ? 'Applicable script restrictions could not be established.' : policy.inlineAllowed ? 'Enforced policies permit arbitrary inline scripts or handlers.' : 'At least one enforced policy restricts each inline script and handler scope.', policy.inlineAllowed === false, policy.inlineAllowed !== null)
  observe('csp-eval', 'CSP dynamic script permissions', 'Enforced policies restrict JavaScript string evaluation',
    policy.evalAllowed === null ? 'Applicable script restrictions could not be established.' : policy.evalAllowed ? 'Enforced policies permit JavaScript string evaluation through unsafe-eval.' : 'At least one enforced script policy omits the unsafe-eval keyword. WebAssembly permission is separate.', policy.evalAllowed === false, policy.evalAllowed !== null)
  observe('csp-objects', 'CSP object sources', 'An object-src directive without a wildcard is recorded',
    policy.objectRestricted ? 'An enforced object-src directive without a wildcard was recorded.' : 'No enforced object-src directive without a wildcard was recorded.', policy.objectRestricted)
  observe('hsts-duration', 'HSTS duration', 'The HTTPS HSTS max-age is at least 31536000 seconds', age === null ? hsts ? 'HSTS duration could not be parsed' : 'HSTS absent' : `HSTS max-age ${age} seconds`, age !== null && age >= 31536000, https && (!hsts || age !== null))
  observe('hsts-subdomains', 'HSTS subdomain declaration', 'A valid nonzero HTTPS HSTS policy specifies includeSubDomains',
    !hstsComplete ? 'The HSTS declaration could not be interpreted' : hstsPolicy?.subdomains ? 'includeSubDomains recorded in a nonzero policy' : 'A nonzero policy with includeSubDomains is absent',
    hstsPolicy?.subdomains === true, https && hstsComplete)
  observe('hsts-preload', 'HSTS preload declaration', 'A valid nonzero HTTPS HSTS policy contains the preload declaration',
    !hstsComplete ? 'The HSTS declaration could not be interpreted' : hstsPolicy?.preload ? 'Preload declaration recorded; browser-list enrollment was not checked' : 'A nonzero policy with preload is absent; browser-list enrollment was not checked',
    hstsPolicy?.preload === true, https && hstsComplete)
  const framed = policy.hasFrameAncestors ? policy.frameProtected : frame === 'deny' || frame === 'sameorigin'
  observe('frame-protection', 'Frame configuration', 'Enforced frame-ancestors restricts parents, or DENY/SAMEORIGIN applies',
    framed === null ? 'The enforced ancestor sources could not be interpreted.' : framed ? 'Restrictive frame configuration recorded.' : policy.hasFrameAncestors ? 'Enforced frame-ancestors permits arbitrary web origins and overrides X-Frame-Options.' : 'Accepted frame configuration absent.', framed === true, framed !== null)
  const nosniff = headerTokens(headers['x-content-type-options'] ?? '')[0].toLowerCase() === 'nosniff'
  observe('x-content-type-options', 'Content type protection', 'The first response field value specifies nosniff',
    nosniff ? 'The first field value enables nosniff' : 'The first field value does not enable nosniff', nosniff)
  const referrerAccepted = Boolean(referrer && referrer !== 'unsafe-url' && referrer !== 'no-referrer-when-downgrade')
  observe('referrer-policy', 'Referrer configuration', 'The last recognized response policy avoids the diagnosed full-URL disclosure settings',
    referrer ? `Effective response policy: ${referrer}. Per-request and document overrides were not tested.`
      : referrerHeader ? 'No recognized response policy. Browser defaults and document overrides were not tested.' : 'Referrer configuration absent',
    referrerAccepted, !referrerHeader || referrer !== undefined)
  for (const [key, header, name, accepted, structured] of [
    ['opener-policy', 'cross-origin-opener-policy', 'Cross-origin opener declaration', ['same-origin', 'same-origin-allow-popups', 'noopener-allow-popups', 'unsafe-none'], true],
    ['embedder-policy', 'cross-origin-embedder-policy', 'Cross-origin embedder declaration', ['require-corp', 'credentialless', 'unsafe-none'], true],
    ['resource-policy', 'cross-origin-resource-policy', 'Cross-origin resource declaration', ['same-origin', 'same-site', 'cross-origin'], false],
  ] as const) {
    const value = headers[header], token = value ? crossOriginPolicyToken(value, structured) : null
    const recognized = token !== null && (accepted as readonly string[]).includes(token)
    const permissive = token === 'unsafe-none' || key === 'resource-policy' && token === 'cross-origin'
    observe(key, name, `A recognized ${header} policy is declared`,
      !value ? `${header} absent` : recognized ? `${header}: ${token}. ${permissive ? 'Explicit permissive configuration observed. A restrictive repair remains unverified.' : 'This records a policy declaration; isolation, embedding and resource delivery were not tested.'}`
        : `${header} could not be interpreted as a recognized policy declaration`, recognized, !value || recognized, recognized && permissive)
  }
  observe('permissions-policy', 'Browser permission configuration', 'A parsed Permissions-Policy without sensitive-feature wildcard tokens is recorded',
    !permissions ? 'Permission configuration absent' : overbroad === null ? 'The Permissions-Policy dictionary could not be interpreted'
      : overbroad.length ? `Wildcard declarations for ${overbroad.join(', ')}` : 'No unrestricted camera, microphone or geolocation wildcard in the parsed response policy; device permission and iframe delegation were not tested',
    Boolean(permissions && overbroad?.length === 0), overbroad !== null)
  const crossDomain = headers['x-permitted-cross-domain-policies']
  observe('cross-domain-policy', 'Legacy cross-domain declaration', 'The cross-domain policy is absent or specifies none', crossDomain ? crossDomain.trim().toLowerCase() === 'none' ? 'Cross-domain declaration specifies none' : 'Cross-domain declaration does not specify none' : 'No legacy cross-domain declaration', !crossDomain || crossDomain.trim().toLowerCase() === 'none')
  return values.filter(item => https || !item.key.startsWith('hsts-'))
}

export function runSecurityHeaderChecks(
  url: string,
  headers: Record<string, string> | null
): DeterministicFlag[] {
  if (headers == null) return []

  const findings: DeterministicFlag[] = []
  const isHttps = url.startsWith('https://')
  let managedHostname: string | null = null
  try {
    const host = new URL(url).hostname
    if (isManagedHostingHostname(host)) managedHostname = host
  } catch {
    managedHostname = null
  }
  const csp = headers['content-security-policy'] ?? null
  const cspReportOnly = headers['content-security-policy-report-only'] ?? null
  const observations = securityHeaderObservations(url, headers)
  const failed = (key: string) => observations.find(item => item.key === key)?.passed === false
  const scoped = (flag: DeterministicFlag, ids = [flag.checkId]): DeterministicFlag => ({ ...flag,
    verificationRule: SECURITY_HEADER_VERIFICATION_RULE,
    evidenceTargets: observations.filter(item => ids.some(id => PAGE_CHECK_DEFINITIONS['security-headers'].assertions[item.key].verifies.includes(id)))
      .map(item => ({ kind: 'page', context: item.context!, source: 'measured', device: 'desktop', label: item.name })),
  })

  if (!csp) {
    findings.push({
      checkId: 'security-csp-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'CRITICAL',
      problem: 'No Content-Security-Policy header',
      evidence:
        'No Content-Security-Policy header found. A CSP is defense-in-depth that limits which scripts and resources can run, reducing the blast radius if a script injection ever occurs.',
      fix: "Add a Content-Security-Policy header. Start with: Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else {
    if (observations.find(item => item.key === 'csp-inline-scripts')?.complete && failed('csp-inline-scripts')) {
      findings.push({
        checkId: 'security-csp-unsafe-inline',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'CSP allows unsafe-inline in script sources',
        evidence: 'The enforced Content-Security-Policy list permits arbitrary inline scripts or handlers after directive overrides, nonce/hash rules and policy intersection.',
        fix: "Where practical, replace unsafe-inline with per-request nonces or hashes, or move inline scripts to external files.",
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }

    if (observations.find(item => item.key === 'csp-eval')?.complete && failed('csp-eval')) {
      findings.push({
        checkId: 'security-csp-unsafe-eval',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'CSP allows unsafe-eval in script sources',
        evidence: 'Every applicable enforced script policy includes the unsafe-eval keyword, allowing JavaScript string evaluation. WebAssembly-only permission is evaluated separately.',
        fix: "Remove 'unsafe-eval' from your CSP. Replace eval() and Function() calls with safer alternatives, and avoid passing strings to setTimeout/setInterval.",
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }

    if (failed('csp-objects')) {
      findings.push({
        checkId: 'security-csp-weak-object-src',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'POLISH',
        problem: 'CSP object-src allows * or is missing',
        evidence: 'No enforced object-src directive without a wildcard was recorded. Other fallback restrictions and plugin execution were not assessed.',
        fix: "Add object-src 'none' to your CSP to prevent embedding of legacy plugins.",
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  if (cspReportOnly && !csp) {
    findings.push({
      checkId: 'security-csp-report-only',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'CSP is report-only, not enforced',
      evidence:
        'Content-Security-Policy-Report-Only header is present but no enforced Content-Security-Policy header exists. Violations are reported but not blocked.',
      fix: 'Convert Content-Security-Policy-Report-Only to Content-Security-Policy after confirming no legitimate content is blocked. Monitor violation reports first.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  // HSTS checks (only meaningful on HTTPS)
  if (isHttps) {
    const hsts = headers['strict-transport-security'] ?? null
    if (!hsts) {
      findings.push({
        checkId: 'security-hsts-missing',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'POLISH',
        problem: 'HTTP Strict-Transport-Security (HSTS) header is missing',
        evidence:
          'No Strict-Transport-Security header on HTTPS response. Users may be vulnerable to SSL-strip attacks on first visit.',
        fix: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    } else {
      const duration = observations.find(item => item.key === 'hsts-duration')
      const maxAge = inspectHsts(hsts)?.age
      if (duration?.complete && maxAge !== undefined && maxAge < 31536000) {
        findings.push({
          checkId: 'security-hsts-too-short',
          rubric: 'REACH',
          impactTag: 'TRUST',
          severity: 'IMPORTANT',
          problem: 'HSTS max-age is less than the recommended 1 year (31536000s)',
          evidence: `Strict-Transport-Security max-age is ${maxAge} seconds (recommended: 31536000, one year).`,
          fix: 'Set HSTS max-age to at least 31536000 (1 year). Consider adding includeSubDomains and preload directives for maximum security.',
          confidence: 1.0,
          source: 'DETERMINISTIC',
        })
      }

      if (observations.find(item => item.key === 'hsts-subdomains')?.complete && failed('hsts-subdomains')) {
        findings.push({
          checkId: 'security-hsts-no-subdomains',
          rubric: 'REACH',
          impactTag: 'TRUST',
          severity: 'POLISH',
          problem: 'HSTS is missing includeSubDomains directive',
          evidence: `Strict-Transport-Security header is "${hsts}" without includeSubDomains in a nonzero policy. Subdomains' own and inherited policies were not checked.`,
          fix: 'Add includeSubDomains to your Strict-Transport-Security header: max-age=31536000; includeSubDomains',
          confidence: 1.0,
          source: 'DETERMINISTIC',
        })
      }

      if (observations.find(item => item.key === 'hsts-preload')?.complete && failed('hsts-preload')) {
        findings.push({
          checkId: 'security-hsts-no-preload',
          rubric: 'REACH',
          impactTag: 'TRUST',
          severity: 'POLISH',
          problem: 'HSTS is missing preload directive',
          evidence: `Strict-Transport-Security header is "${hsts}" without preload in a nonzero policy. Browser-list enrollment was not checked.`,
          fix: 'Add preload to your HSTS header and submit to browser preload lists. Example: max-age=63072000; includeSubDomains; preload',
          confidence: 1.0,
          source: 'DETERMINISTIC',
        })
      }
    }
  }

  // CSP frame-ancestors supersedes X-Frame-Options in modern browsers; skip both
  // frame-options checks when it's present to avoid flagging the same risk twice.
  if (failed('frame-protection') && observations.find(item => item.key === 'frame-protection')?.complete) {
    const frameOptions = headers['x-frame-options'] ?? null
    if (inspectCsp(csp ?? '').hasFrameAncestors) {
      findings.push({ checkId: 'security-csp-frame-ancestors-permissive', rubric: 'REACH', impactTag: 'TRUST', severity: 'POLISH',
        problem: 'CSP permits framing from arbitrary web origins',
        evidence: 'The enforced frame-ancestors policy permits arbitrary web origins. It overrides X-Frame-Options, including DENY or SAMEORIGIN.',
        fix: "Set frame-ancestors 'none' to prevent embedding, or specify 'self' and the trusted parent origins you require. Repeat the same public response check.",
        confidence: 1, source: 'DETERMINISTIC' })
    } else if (!frameOptions) {
      findings.push({
        checkId: 'security-frame-options-missing',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'POLISH',
        problem: 'X-Frame-Options header is missing',
        evidence:
          'No X-Frame-Options header. The page could be embedded in a frame on another domain (clickjacking risk).',
        fix: 'Add X-Frame-Options: DENY or X-Frame-Options: SAMEORIGIN',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    } else if (!['deny', 'sameorigin'].includes(frameOptions.trim().toLowerCase())) {
      findings.push({
        checkId: 'security-frame-options-too-permissive',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'POLISH',
        problem: 'X-Frame-Options is not DENY or SAMEORIGIN',
        evidence: `X-Frame-Options is set to "${frameOptions}", which most browsers no longer honor safely.`,
        fix: 'Set X-Frame-Options to DENY or SAMEORIGIN. For embedding pages, use a CSP frame-ancestors directive with specific trusted origins.',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  if (failed('x-content-type-options')) {
    findings.push({
      checkId: 'security-content-type-options-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'IMPORTANT',
      problem: 'X-Content-Type-Options header is missing or not set to nosniff',
      evidence: headers['x-content-type-options']
        ? `X-Content-Type-Options is "${headers['x-content-type-options']}" instead of "nosniff"`
        : 'No X-Content-Type-Options header found. Browsers may MIME-sniff resources, enabling certain attacks.',
      fix: 'Add X-Content-Type-Options: nosniff',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  // Note: X-XSS-Protection is intentionally not checked. The header is deprecated
  // and OWASP recommends against setting it (it can introduce vulnerabilities in
  // older browsers); CSP is the modern replacement. Flagging its absence would be
  // a false positive on correctly configured modern sites.

  // Referrer Policy
  const referrerPolicy = headers['referrer-policy'] ?? null
  if (!referrerPolicy) {
    findings.push({
      checkId: 'security-referrer-policy-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Referrer-Policy header is missing',
      evidence:
        'No Referrer-Policy response header found. Browser defaults and document or per-request overrides were not evaluated.',
      fix: 'Add Referrer-Policy: strict-origin-when-cross-origin to limit referrer information sent to other origins.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else {
    if (observations.find(item => item.key === 'referrer-policy')?.complete && failed('referrer-policy')) {
      findings.push({
        checkId: 'security-referrer-policy-weak',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'POLISH',
        problem: 'Referrer-Policy allows full URL disclosure to third parties',
        evidence: `Referrer-Policy is set to "${referrerPolicy}", which may expose full URLs including query parameters to cross-origin requests.`,
        fix: 'Set Referrer-Policy to strict-origin-when-cross-origin or no-referrer to protect URL data.',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  // Cross-Origin Policies
  if (observations.find(item => item.key === 'opener-policy')?.complete && failed('opener-policy')) {
    findings.push({
      checkId: 'security-coop-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Cross-Origin-Opener-Policy header is missing',
      evidence:
        'No Cross-Origin-Opener-Policy response header found. Opener relationships were not tested.',
      fix: 'Add Cross-Origin-Opener-Policy: same-origin to isolate your page from cross-origin opener access.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (observations.find(item => item.key === 'embedder-policy')?.complete && failed('embedder-policy')) {
    findings.push({
      checkId: 'security-coep-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Cross-Origin-Embedder-Policy header is missing',
      evidence:
        'No Cross-Origin-Embedder-Policy response header found. Cross-origin resource delivery was not tested.',
      fix: 'Add Cross-Origin-Embedder-Policy: require-corp if your site does not load uncredentialed cross-origin resources. Otherwise use credentialless.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (observations.find(item => item.key === 'resource-policy')?.complete && failed('resource-policy')) {
    findings.push({
      checkId: 'security-corp-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Cross-Origin-Resource-Policy header is missing',
      evidence:
        'No Cross-Origin-Resource-Policy response header found. Resource use and embedding context were not evaluated.',
      fix: 'Add Cross-Origin-Resource-Policy: same-origin to restrict resource loading to same-origin requests.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  // Permissions Policy
  const permissionsPolicy = headers['permissions-policy'] ?? null
  if (!permissionsPolicy) {
    findings.push({
      checkId: 'security-permissions-policy-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Permissions-Policy header is missing',
      evidence:
        'No Permissions-Policy response header found. Browser feature defaults, device permission and iframe delegation were not evaluated.',
      fix: 'Add a Permissions-Policy header to restrict sensitive browser features. Example: Permissions-Policy: camera=(), microphone=(), geolocation=()',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else {
    const overbroad = sensitivePermissionWildcards(permissionsPolicy)
    if (overbroad?.length) {
      findings.push({
        checkId: 'security-permissions-policy-overbroad',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: `Permissions-Policy allows ${overbroad.join(', ')} for *`,
        evidence: `Permissions-Policy declares unrestricted origins for ${overbroad.join(', ')}: "${permissionsPolicy}". Device permission and iframe delegation were not tested.`,
        fix: `Restrict sensitive features in your Permissions-Policy: ${overbroad.map((f) => `${f}=()`).join(', ')}`,
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  // X-Permitted-Cross-Domain-Policies (legacy Flash/PDF)
  const xPermitted = headers['x-permitted-cross-domain-policies'] ?? null
  if (xPermitted && failed('cross-domain-policy')) {
    findings.push({
      checkId: 'security-x-permitted-cross-domain',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'X-Permitted-Cross-Domain-Policies header is present',
      evidence: `X-Permitted-Cross-Domain-Policies is set to "${xPermitted}". This header controls cross-domain requests for legacy Flash and PDF, which should be restricted.`,
      fix: 'Set X-Permitted-Cross-Domain-Policies: none or remove the header entirely if you do not use legacy Flash or cross-domain PDF requests.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  // Consolidate only when core security headers are missing/weak. Aspirational
  // hardening (preload, Referrer-Policy, COOP/COEP, Permissions-Policy, etc.)
  // stays as individual POLISH findings so we never claim CSP/HSTS/XCTO/frame
  // are missing when they are already present.
  const CORE_SECURITY_HEADER_IDS = new Set([
    'security-csp-missing',
    'security-hsts-missing',
    'security-hsts-too-short',
    'security-frame-options-missing',
    'security-frame-options-too-permissive',
    'security-csp-frame-ancestors-permissive',
    'security-content-type-options-missing',
  ])
  const ASPIRATIONAL_SECURITY_HEADER_IDS = new Set([
    'security-csp-unsafe-inline',
    'security-csp-unsafe-eval',
    'security-csp-weak-object-src',
    'security-csp-report-only',
    'security-hsts-no-subdomains',
    'security-hsts-no-preload',
    'security-referrer-policy-missing',
    'security-referrer-policy-weak',
    'security-coop-missing',
    'security-coep-missing',
    'security-corp-missing',
    'security-permissions-policy-missing',
    'security-permissions-policy-overbroad',
    'security-x-permitted-cross-domain',
  ])
  const coreFindings = findings.filter((f) => CORE_SECURITY_HEADER_IDS.has(f.checkId))
  const aspirationalFindings = findings.filter((f) =>
    ASPIRATIONAL_SECURITY_HEADER_IDS.has(f.checkId)
  )
  const shouldConsolidateCore =
    coreFindings.length >= 3 || (managedHostname != null && coreFindings.length >= 1)

  const rollupAspirational = (items: DeterministicFlag[]): DeterministicFlag[] => {
    if (items.length < 3) return items
    const names = items.map((f) => f.problem.replace(/\.$/, '')).join('; ')
    const managedNote = managedHostname
      ? ` ${managedHostConstraintNote(managedHostname)}`
      : ''
    return [
      scoped({
        checkId: 'security-headers-hardening',
        rubric: 'REACH' as const,
        impactTag: 'TRUST' as const,
        severity: 'POLISH' as const,
        problem: `${items.length} security header hardening gaps`,
        evidence: `Hardening gaps (core CSP/HSTS/XCTO/frame already present or handled separately): ${names}.${managedNote}`,
        fix: managedHostname
          ? 'These hardening headers usually cannot be set on a managed builder subdomain. Connect a custom domain and configure Referrer-Policy, COOP/COEP/CORP, and Permissions-Policy on your DNS/proxy/CDN.'
          : 'Add defense-in-depth headers that are still missing: Referrer-Policy, Cross-Origin-Opener-Policy, Cross-Origin-Embedder-Policy, Cross-Origin-Resource-Policy, and/or Permissions-Policy as appropriate. Tighten HSTS with includeSubDomains/preload only after subdomains are ready. Do not treat this as missing CSP, HSTS, XCTO, or frame protection.',
        confidence: 1.0,
        source: 'DETERMINISTIC' as const,
      }, items.map(item => item.checkId)),
    ]
  }

  if (shouldConsolidateCore) {
    const names = coreFindings.map((f) => f.problem.replace(/\.$/, '')).join('; ')
    const hardeningNote =
      aspirationalFindings.length > 0
        ? ` Additional hardening gaps (${aspirationalFindings.length}) are secondary and omitted from this Flag.`
        : ''
    const managedNote = managedHostname
      ? ` ${managedHostConstraintNote(managedHostname)}`
      : ''
    const missingCores = coreFindings.map((f) => f.checkId)
    const fixParts: string[] = []
    if (missingCores.includes('security-csp-missing')) {
      fixParts.push('Content-Security-Policy')
    }
    if (
      missingCores.includes('security-hsts-missing') ||
      missingCores.includes('security-hsts-too-short')
    ) {
      fixParts.push('Strict-Transport-Security (max-age=31536000)')
    }
    if (missingCores.includes('security-frame-options-missing')) {
      fixParts.push('X-Frame-Options: DENY or SAMEORIGIN (or CSP frame-ancestors)')
    } else if (missingCores.includes('security-frame-options-too-permissive')) {
      fixParts.push('X-Frame-Options: DENY or SAMEORIGIN')
    }
    if (missingCores.includes('security-content-type-options-missing')) {
      fixParts.push('X-Content-Type-Options: nosniff')
    }
    const consolidated: DeterministicFlag = {
      checkId: 'security-headers-missing',
      rubric: 'REACH' as const,
      impactTag: 'TRUST' as const,
      severity: 'POLISH' as const,
      problem: `${coreFindings.length} core security headers are missing or weak`,
      evidence: `Missing or weak core headers: ${names}. These headers provide defense-in-depth against common web vulnerabilities.${hardeningNote}${managedNote}`,
      fix: managedHostname
        ? 'These headers usually cannot be set on a managed builder subdomain. Connect a custom domain and configure CSP/HSTS/Permissions-Policy on your DNS/proxy/CDN, or in the host platform\'s custom-header settings.'
        : `Add the following HTTP response headers: ${fixParts.join('; ')}. Start with restrictive defaults and relax as needed. X-Frame-Options: SAMEORIGIN already satisfies clickjacking protection when present.`,
      confidence: 1.0,
      source: 'DETERMINISTIC' as const,
    }
    // When cores are missing, one Flag is enough - do not also emit a hardening
    // rollup that would dominate Finish Plan / accuracy top-3 slots.
    return [scoped(consolidated, coreFindings.map(item => item.checkId))]
  }

  const aspirationalOut = rollupAspirational(aspirationalFindings)
  const remaining = findings.filter(
    (f) =>
      !CORE_SECURITY_HEADER_IDS.has(f.checkId) &&
      !ASPIRATIONAL_SECURITY_HEADER_IDS.has(f.checkId)
  )
  const withCores = [...coreFindings, ...aspirationalOut, ...remaining].map(flag => flag.verificationRule ? flag : scoped(flag))

  // Remaining findings on managed hosts still must not escalate severity.
  if (managedHostname) {
    return withCores.map((f) => ({
      ...f,
      severity: 'POLISH' as const,
      evidence: `${f.evidence} ${managedHostConstraintNote(managedHostname)}`,
    }))
  }

  return withCores
}
