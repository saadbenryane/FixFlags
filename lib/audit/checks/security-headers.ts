import type { DeterministicFlag } from './index'

export function runSecurityHeaderChecks(
  url: string,
  responseHeaders: Record<string, string> | null
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (!responseHeaders) return findings

  const normalize = (key: string) => key.toLowerCase()
  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(responseHeaders)) {
    headers[normalize(k)] = v
  }

  const csp = headers['content-security-policy']
  const hsts = headers['strict-transport-security']
  const xfo = headers['x-frame-options']
  const ct = headers['x-content-type-options']
  const xss = headers['x-xss-protection']

  const isHttps = url.startsWith('https://')

  // CSP checks
  if (!csp) {
    findings.push({
      checkId: 'security-csp-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'CRITICAL',
      problem: 'Content Security Policy (CSP) header is missing',
      evidence:
        'No Content-Security-Policy header found in the HTTP response. Pages without CSP are vulnerable to XSS and data injection attacks.',
      fix: 'Add a Content-Security-Policy header. Start with: default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else {
    const hasUnsafeInline = /\bunsafe-inline\b/.test(csp)
    const inScriptSrc = /script-src[^;]*unsafe-inline/.test(csp)
    const inDefaultSrc = !/script-src\s/.test(csp) && /default-src[^;]*unsafe-inline/.test(csp)
    if (hasUnsafeInline && (inScriptSrc || inDefaultSrc)) {
      findings.push({
        checkId: 'security-csp-unsafe-inline',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'CSP allows unsafe-inline in script sources',
        evidence:
          'Content-Security-Policy includes unsafe-inline in script-src or default-src. This weakens XSS protection significantly.',
        fix: 'Replace unsafe-inline with a nonce or hash-based approach for inline scripts. Example: script-src \'nonce-<random>\'',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  // HSTS checks (only meaningful on HTTPS)
  if (isHttps) {
    if (!hsts) {
      findings.push({
        checkId: 'security-hsts-missing',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'HTTP Strict-Transport-Security (HSTS) header is missing',
        evidence:
          'No Strict-Transport-Security header on HTTPS response. Users may be vulnerable to SSL-strip attacks on first visit.',
        fix: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    } else {
      const maxAgeMatch = hsts.match(/max-age=(\d+)/i)
      if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1], 10)
        if (maxAge < 31536000) {
          findings.push({
            checkId: 'security-hsts-too-short',
            rubric: 'REACH',
            impactTag: 'TRUST',
            severity: 'POLISH',
            problem: 'HSTS max-age is less than the recommended 1 year (31536000s)',
            evidence: `Strict-Transport-Security max-age is ${maxAge}s. The recommended minimum is 31536000s (1 year).`,
            fix: 'Set max-age to at least 31536000 (e.g., Strict-Transport-Security: max-age=31536000; includeSubDomains)',
            confidence: 1.0,
            source: 'DETERMINISTIC',
          })
        }
      }
    }
  }

  // X-Frame-Options checks
  const hasFrameAncestors = csp ? /\bframe-ancestors\b/.test(csp) : false
  if (!hasFrameAncestors) {
    if (!xfo) {
      findings.push({
        checkId: 'security-frame-options-missing',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'X-Frame-Options header is missing',
        evidence:
          'No X-Frame-Options header. The page could be embedded in a frame on another domain (clickjacking risk).',
        fix: 'Add X-Frame-Options: DENY or X-Frame-Options: SAMEORIGIN',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    } else if (xfo !== 'DENY' && xfo !== 'SAMEORIGIN') {
      findings.push({
        checkId: 'security-frame-options-too-permissive',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'X-Frame-Options is set to a permissive value',
        evidence: `X-Frame-Options is "${xfo}". Only DENY and SAMEORIGIN provide clickjacking protection.`,
        fix: 'Change X-Frame-Options to DENY (preferred) or SAMEORIGIN',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  // X-Content-Type-Options checks
  if (!ct || ct.toLowerCase() !== 'nosniff') {
    findings.push({
      checkId: 'security-content-type-options-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'IMPORTANT',
      problem: 'X-Content-Type-Options header is missing or not set to nosniff',
      evidence: ct
        ? `X-Content-Type-Options is "${ct}" instead of "nosniff"`
        : 'No X-Content-Type-Options header found. Browsers may MIME-sniff resources, enabling certain attacks.',
      fix: 'Add X-Content-Type-Options: nosniff',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  // X-XSS-Protection checks
  if (!xss) {
    findings.push({
      checkId: 'security-xss-protection-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'X-XSS-Protection header is missing',
      evidence:
        'No X-XSS-Protection header found. Note: modern browsers have deprecated this header in favor of CSP, but including it provides defense-in-depth for legacy browsers.',
      fix: 'Add X-XSS-Protection: 1; mode=block (though CSP is the modern replacement)',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
