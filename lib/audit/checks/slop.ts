import { PageMetadata } from '../metadata'
import { DeterministicFlag } from './index'

const PLACEHOLDER_PATTERNS = [
  { pattern: /lorem ipsum/i, label: 'Lorem ipsum placeholder text' },
  { pattern: /\bTODO\b/, label: 'TODO marker' },
  { pattern: /\bTBD\b/, label: 'TBD marker' },
  { pattern: /\[object Object\]/, label: '[object Object]' },
  { pattern: /\bundefined\b/, label: 'literal "undefined" in page text' },
]

const TEMPLATE_COPY_PATTERNS = [
  { pattern: /welcome to/i, label: 'Welcome to…' },
  { pattern: /your company/i, label: 'Your Company' },
  { pattern: /coming soon/i, label: 'Coming soon' },
  { pattern: /hello world/i, label: 'Hello world' },
]

const TEMPLATE_TOKEN_PATTERN = /\{\{[^}]+\}\}|\$\{[^}]+\}|%[A-Z_]+%/i

const CTA_PATTERN =
  /get started|sign up|signup|start free|try free|book demo|contact|register|join/i

function isDeadHref(href: string): boolean {
  const normalized = href.trim().toLowerCase()
  return (
    normalized === '' ||
    normalized === '#' ||
    normalized.startsWith('javascript:void') ||
    normalized === 'javascript:;'
  )
}

export function runSlopChecks(meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const sampleText = [meta.pageText, ...meta.h1s].join(' ').slice(0, 8000)

  for (const { pattern, label } of PLACEHOLDER_PATTERNS) {
    if (pattern.test(sampleText)) {
      findings.push({
        checkId: 'placeholder-copy-detected',
        rubric: 'MESSAGE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: 'Placeholder or unfinished copy detected on the page',
        evidence: `Found ${label} in visible page text`,
        fix: 'Replace placeholder text with product-specific copy before sharing the link publicly.',
        confidence: 0.95,
        source: 'DETERMINISTIC',
      })
      break
    }
  }

  for (const { pattern, label } of TEMPLATE_COPY_PATTERNS) {
    if (pattern.test(sampleText)) {
      findings.push({
        checkId: 'template-default-copy',
        rubric: 'MESSAGE',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'Template or generic default copy detected',
        evidence: `Found "${label}" pattern in page text`,
        fix: 'Replace generic template copy with a specific headline that names your product, audience, and outcome.',
        confidence: 0.85,
        source: 'DETERMINISTIC',
      })
      break
    }
  }

  if (TEMPLATE_TOKEN_PATTERN.test(sampleText)) {
    findings.push({
      checkId: 'unreplaced-template-token',
      rubric: 'MESSAGE',
      impactTag: 'TRUST',
      severity: 'CRITICAL',
      problem: 'Unreplaced template token visible on the page',
      evidence: 'Found {{…}}, ${…}, or %VAR% style token in visible text',
      fix: 'Replace template tokens with real values. Check env vars and CMS fields did not leak into the rendered page.',
      confidence: 0.95,
      source: 'DETERMINISTIC',
    })
  }

  const deadCtaLinks = meta.links.filter(
    (link) => isDeadHref(link.href) && CTA_PATTERN.test(`${link.href} ${link.text}`)
  )
  if (deadCtaLinks.length > 0) {
    const sample = deadCtaLinks[0]
    findings.push({
      checkId: 'cta-dead-link',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'CRITICAL',
      problem: 'Primary CTA link points to a dead or empty destination',
      evidence: `Link "${sample.text || '(no text)'}" uses href="${sample.href}"`,
      fix: 'Point the CTA to a real route (signup, pricing, or contact). Replace href="#" with the actual destination URL.',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
