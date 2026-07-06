import { PageMetadata } from '../metadata'
import { isDeadHref } from '../flow/link-scoring'
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

const SOCIAL_PROOF_SLOP_PATTERNS = [
  { pattern: /trusted by\s+\d[\d,]*\+?\s*(teams|customers|users|companies)?/i, label: 'unverifiable member count' },
  { pattern: /\b\d[\d,]*\+?\s*(happy|satisfied)\s+customers/i, label: 'unverifiable customer count' },
  { pattern: /\[company name\]/i, label: 'placeholder company name' },
  { pattern: /your logo here/i, label: 'logo placeholder' },
  { pattern: /\blogo\s+\d\b/i, label: 'generic logo placeholder' },
  { pattern: /\b[A-Z][a-z]\.\s*,\s*(CEO|Founder)/, label: 'anonymous testimonial initials' },
  { pattern: /CEO,\s*Company Name/i, label: 'template testimonial attribution' },
  { pattern: /lorem ipsum.*testimonial/i, label: 'lorem testimonial' },
]

export function detectSocialProofSlop(text: string): string | null {
  for (const { pattern, label } of SOCIAL_PROOF_SLOP_PATTERNS) {
    if (pattern.test(text)) return label
  }
  return null
}

export function runSlopChecks(meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const h1Generic =
    meta.h1s.length > 0 &&
    ['home', 'welcome', 'welcome to', 'untitled', 'coming soon', 'hello world'].some((p) =>
      meta.h1s[0].toLowerCase().includes(p)
    )
  const bodyText = meta.pageText.slice(0, 8000)
  const sampleText = h1Generic ? bodyText : [meta.pageText, ...meta.h1s].join(' ').slice(0, 8000)

  for (const { pattern, label } of PLACEHOLDER_PATTERNS) {
    if (pattern.test(sampleText)) {
      findings.push({
        checkId: 'placeholder-copy-detected',
        rubric: 'MESSAGE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: 'Placeholder or unfinished copy detected on the page',
        evidence: `Found ${label} in visible page text`,
        fix: '1. Replace placeholder text with product-specific copy\n2. Review the entire page for any remaining placeholder content\n3. Test the live page to confirm no placeholder text is visible',
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
        fix: '1. Replace generic template copy with a specific headline\n2. Name the product, audience, and outcome in the headline\n3. Review other sections for template defaults (CTAs, subheadings)',
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
      fix: '1. Replace template tokens ({{…}}, ${…}, %VAR%) with real values\n2. Check env vars and CMS fields did not leak into the rendered page\n3. Set fallback values for any optional template variables',
      confidence: 0.95,
      source: 'DETERMINISTIC',
    })
  }

  const elementIdSet = new Set(meta.elementIds)
  const deadCtaLinks = meta.links.filter((link) => {
    const href = link.href
    // Hash target that exists on the page is not dead
    if (href.startsWith('#')) {
      const targetId = href.slice(1).toLowerCase()
      if (elementIdSet.has(targetId)) return false
    }
    return isDeadHref(href) && CTA_PATTERN.test(`${href} ${link.text}`)
  })
  if (deadCtaLinks.length > 0) {
    const sample = deadCtaLinks[0]
    findings.push({
      checkId: 'cta-dead-link',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'CRITICAL',
      problem: 'Primary CTA link points to a dead or empty destination',
      evidence: `Link "${sample.text || '(no text)'}" uses href="${sample.href}"`,
      fix: '1. Point the CTA to a real route (signup, pricing, or contact)\n2. Replace href="#" with the actual destination URL\n3. Test the CTA link after the change',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  const socialSlop = detectSocialProofSlop(sampleText)
  if (socialSlop) {
    findings.push({
      checkId: 'social-proof-unverifiable',
      rubric: 'MESSAGE',
      impactTag: 'TRUST',
      severity: 'IMPORTANT',
      problem: 'Social proof looks placeholder or unverifiable',
      evidence: `Found ${socialSlop} in visible page text`,
      fix: '1. Replace fake stats with real, verifiable numbers\n2. Replace logo placeholders with actual customer logos\n3. Replace anonymous testimonials with real quotes with named attribution',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
