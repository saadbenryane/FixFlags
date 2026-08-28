import type { DeterministicFlag } from '../flag-types'

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

function parseMaxAge(value: string): number | null {
  const match = value.match(/max-age\s*=\s*(\d+)/i)
  return match ? Number(match[1]) : null
}

function cspDirective(csp: string, name: string): string | null {
  const match = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(`${name} `) || part.toLowerCase() === name)
  return match ?? null
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
    const scriptSrc = cspDirective(csp, 'script-src') ?? cspDirective(csp, 'default-src')
    if (scriptSrc?.includes('unsafe-inline')) {
      findings.push({
        checkId: 'security-csp-unsafe-inline',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'CSP allows unsafe-inline in script sources',
        evidence: `Content-Security-Policy includes 'unsafe-inline' in ${scriptSrc.split(' ')[0]}, which weakens its script protection.`,
        fix: "Where practical, replace unsafe-inline with per-request nonces or hashes, or move inline scripts to external files.",
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }

    if (scriptSrc?.includes('unsafe-eval')) {
      findings.push({
        checkId: 'security-csp-unsafe-eval',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'CSP allows unsafe-eval in script sources',
        evidence: `Content-Security-Policy includes 'unsafe-eval' in ${scriptSrc.split(' ')[0]}, which allows dynamic code execution from strings (eval, Function, setTimeout with string).`,
        fix: "Remove 'unsafe-eval' from your CSP. Replace eval() and Function() calls with safer alternatives, and avoid passing strings to setTimeout/setInterval.",
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }

    const objectSrc = cspDirective(csp, 'object-src')
    if (!objectSrc || objectSrc.includes('*')) {
      findings.push({
        checkId: 'security-csp-weak-object-src',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'POLISH',
        problem: 'CSP object-src allows * or is missing',
        evidence: objectSrc
          ? `Content-Security-Policy object-src is "${objectSrc}", which allows embedding legacy plugins.`
          : 'No object-src directive in CSP. Without it, plugins (Flash, Java) could be embedded without restriction.',
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
      const maxAge = parseMaxAge(hsts)
      if (maxAge !== null && maxAge < 31536000) {
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

      if (!hsts.toLowerCase().includes('includesubdomains')) {
        findings.push({
          checkId: 'security-hsts-no-subdomains',
          rubric: 'REACH',
          impactTag: 'TRUST',
          severity: 'POLISH',
          problem: 'HSTS is missing includeSubDomains directive',
          evidence: `Strict-Transport-Security header is "${hsts}" but does not include includeSubDomains, so subdomains remain unprotected.`,
          fix: 'Add includeSubDomains to your Strict-Transport-Security header: max-age=31536000; includeSubDomains',
          confidence: 1.0,
          source: 'DETERMINISTIC',
        })
      }

      if (!hsts.toLowerCase().includes('preload')) {
        findings.push({
          checkId: 'security-hsts-no-preload',
          rubric: 'REACH',
          impactTag: 'TRUST',
          severity: 'POLISH',
          problem: 'HSTS is missing preload directive',
          evidence: `Strict-Transport-Security header is "${hsts}" but does not include preload, so the site cannot be included in browser HSTS preload lists.`,
          fix: 'Add preload to your HSTS header and submit to browser preload lists. Example: max-age=63072000; includeSubDomains; preload',
          confidence: 1.0,
          source: 'DETERMINISTIC',
        })
      }
    }
  }

  // CSP frame-ancestors supersedes X-Frame-Options in modern browsers; skip both
  // frame-options checks when it's present to avoid flagging the same risk twice.
  if (!csp || !cspDirective(csp, 'frame-ancestors')) {
    const frameOptions = headers['x-frame-options'] ?? null
    if (!frameOptions) {
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

  if (!headers['x-content-type-options']?.toLowerCase().includes('nosniff')) {
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
        'No Referrer-Policy header found. Full URLs may leak to third-party sites via the Referer header.',
      fix: 'Add Referrer-Policy: strict-origin-when-cross-origin to limit referrer information sent to other origins.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else {
    const lower = referrerPolicy.toLowerCase().trim()
    if (lower.includes('unsafe-url') || lower === 'no-referrer-when-downgrade') {
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
  if (!headers['cross-origin-opener-policy']) {
    findings.push({
      checkId: 'security-coop-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Cross-Origin-Opener-Policy header is missing',
      evidence:
        'No Cross-Origin-Opener-Policy header found. The page shares a browsing context group with cross-origin popups and openers.',
      fix: 'Add Cross-Origin-Opener-Policy: same-origin to isolate your page from cross-origin opener access.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!headers['cross-origin-embedder-policy']) {
    findings.push({
      checkId: 'security-coep-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Cross-Origin-Embedder-Policy header is missing',
      evidence:
        'No Cross-Origin-Embedder-Policy header found. Cross-origin resources load without explicit opt-in.',
      fix: 'Add Cross-Origin-Embedder-Policy: require-corp if your site does not load uncredentialed cross-origin resources. Otherwise use credentialless.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!headers['cross-origin-resource-policy']) {
    findings.push({
      checkId: 'security-corp-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'Cross-Origin-Resource-Policy header is missing',
      evidence:
        'No Cross-Origin-Resource-Policy header found. Resources can be loaded by any origin.',
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
        'No Permissions-Policy header found. Browser features are unrestricted for the page and any embedded frames.',
      fix: 'Add a Permissions-Policy header to restrict sensitive browser features. Example: Permissions-Policy: camera=(), microphone=(), geolocation=()',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else {
    const sensitiveFeatures = ['camera', 'microphone', 'geolocation'] as const
    const overbroad = sensitiveFeatures.filter((f) =>
      permissionsPolicy.toLowerCase().includes(`${f}=*`)
    )
    if (overbroad.length > 0) {
      findings.push({
        checkId: 'security-permissions-policy-overbroad',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: `Permissions-Policy allows ${overbroad.join(', ')} for *`,
        evidence: `Permissions-Policy header allows ${overbroad.join(', ')} to be used by any origin: "${permissionsPolicy}"`,
        fix: `Restrict sensitive features in your Permissions-Policy: ${overbroad.map((f) => `${f}=()`).join(', ')}`,
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  // X-Permitted-Cross-Domain-Policies (legacy Flash/PDF)
  const xPermitted = headers['x-permitted-cross-domain-policies'] ?? null
  if (xPermitted && xPermitted.trim().toLowerCase() !== 'none') {
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
      {
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
      },
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
    return [consolidated]
  }

  const aspirationalOut = rollupAspirational(aspirationalFindings)
  const remaining = findings.filter(
    (f) =>
      !CORE_SECURITY_HEADER_IDS.has(f.checkId) &&
      !ASPIRATIONAL_SECURITY_HEADER_IDS.has(f.checkId)
  )
  const withCores = [...coreFindings, ...aspirationalOut, ...remaining]

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
