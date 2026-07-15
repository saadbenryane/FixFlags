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
      // Hardening recommendation, not a live vulnerability: most static marketing
      // pages ship without a CSP and are fine. Kept at POLISH so it never leads a
      // report with a false "critically vulnerable" alarm on a normal landing page.
      severity: 'POLISH',
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
        // A site that ships a CSP at all is ahead of most; unsafe-inline is a
        // common, often unavoidable tradeoff (inline analytics, framework runtime).
        severity: 'POLISH',
        problem: 'CSP allows unsafe-inline in script sources',
        evidence: `Content-Security-Policy includes 'unsafe-inline' in ${scriptSrc.split(' ')[0]}, which weakens its script protection.`,
        fix: "Where practical, replace unsafe-inline with per-request nonces or hashes, or move inline scripts to external files.",
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
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
          severity: 'POLISH',
          problem: 'HSTS max-age is less than the recommended 1 year (31536000s)',
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
      severity: 'POLISH',
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

  return findings
}
