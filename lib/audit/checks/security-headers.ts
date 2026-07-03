import type { DeterministicFlag } from './index'

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
  const csp = headers['content-security-policy'] ?? null

  if (!csp) {
    findings.push({
      checkId: 'security-csp-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'CRITICAL',
      problem: 'No Content-Security-Policy header',
      evidence: 'The response has no Content-Security-Policy header, leaving the page without a script/style allowlist.',
      fix: "Implement a strict CSP with policy like: Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none';",
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
        problem: "CSP allows 'unsafe-inline' scripts",
        evidence: `Content-Security-Policy includes 'unsafe-inline' in ${scriptSrc.split(' ')[0]}, which defeats most CSP script protections.`,
        fix: "Remove unsafe-inline from CSP. Use nonce/credit-hash for scripts, or move inline code to external files.",
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  }

  if (isHttps) {
    const hsts = headers['strict-transport-security'] ?? null
    if (!hsts) {
      findings.push({
        checkId: 'security-hsts-missing',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'No Strict-Transport-Security header',
        evidence: 'The HTTPS response has no Strict-Transport-Security header, so browsers will not enforce HTTPS on future visits.',
        fix: 'Add HSTS header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
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
          severity: 'POLISH',
          problem: 'HSTS max-age is below one year',
          evidence: `Strict-Transport-Security max-age is ${maxAge} seconds (recommended: 31536000, one year).`,
          fix: 'Set HSTS max-age to at least 31536000 (1 year). Consider adding includeSubDomains and preload directives for maximum security.',
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
        severity: 'IMPORTANT',
        problem: 'No X-Frame-Options header',
        evidence: 'The response has no X-Frame-Options header, so the page can be framed by any site (clickjacking risk).',
        fix: 'Add X-Frame-Options: DENY (prevents all framing) or X-Frame-Options: SAMEORIGIN (allows framing from same origin).',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    } else if (!['deny', 'sameorigin'].includes(frameOptions.trim().toLowerCase())) {
      findings.push({
        checkId: 'security-frame-options-too-permissive',
        rubric: 'REACH',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
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
      severity: 'POLISH',
      problem: 'No X-Content-Type-Options: nosniff header',
      evidence: 'The response has no X-Content-Type-Options: nosniff header, allowing browsers to MIME-sniff responses.',
      fix: 'Add X-Content-Type-Options: nosniff to prevent MIME type sniffing.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!headers['x-xss-protection']) {
    findings.push({
      checkId: 'security-xss-protection-missing',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: 'No X-XSS-Protection header',
      evidence: 'The response has no X-XSS-Protection header. Modern browsers ignore this header in favor of CSP, but it still helps on older browsers.',
      fix: 'Add X-XSS-Protection: 1; mode=block to enable the XSS filter in older browsers.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
