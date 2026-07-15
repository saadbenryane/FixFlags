import { PageMetadata } from '../metadata'
import { isDeadHref } from '../flow/link-scoring'
import { DeterministicFlag } from './index'
import { MAX_RAW_TEXT } from '../page-text-limits'

const PLACEHOLDER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /lorem ipsum/i, label: 'Lorem ipsum placeholder text' },
  { pattern: /\bTODO\b/, label: 'TODO marker' },
  { pattern: /\bTBD\b/, label: 'TBD marker' },
  { pattern: /\[object Object\]/, label: '[object Object]' },
  { pattern: /\bundefined\b/, label: 'literal "undefined" in page text' },
]

// Template-default phrases are only a real signal when they dominate a heading
// or the title (an unedited starter template). Matched against body prose they
// false-positive on legitimate copy ("start your company", "welcome to the
// future of…"), so these patterns are the full template phrases and are checked
// against headings/title only, never the page body.
const TEMPLATE_COPY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /your company name/i, label: 'Your Company Name' },
  { pattern: /welcome to your (website|company|site|store|page|app|brand)/i, label: 'Welcome to Your…' },
  { pattern: /\bhello world\b/i, label: 'Hello world' },
  { pattern: /\buntitled\b/i, label: 'Untitled' },
]

const AI_BUILDER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bbuilt with\s+(lovable|bolt|v0|cursor|windsurf)\b/i, label: 'AI-builder watermark' },
  { pattern: /\b(add|enter)\s+your\s+(own\s+)?(content|images?|text|logo|details|information|team|data)\b/i, label: 'fill-in-your-own template' },
  { pattern: /double.?click to edit|click to edit|click here to edit/i, label: 'in-page editor instruction' },
  { pattern: /\bthis\s+(is\s+a\s+)?(template|demo|example|sample)\s+(page|site|app)\b/i, label: 'template self-identification' },
  { pattern: /\[your\s+(brand|company|product|name|logo|text|image|content)\]/i, label: 'bracket-brand placeholder' },
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

export function detectSocialProofSlop(text: string): { label: string; matched: string } | null {
  for (const { pattern, label } of SOCIAL_PROOF_SLOP_PATTERNS) {
    const match = text.match(pattern)
    if (match) return { label, matched: match[0] }
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
  const bodyText = meta.pageText.slice(0, MAX_RAW_TEXT)
  const sampleText = h1Generic ? bodyText : [meta.pageText, ...meta.h1s].join(' ').slice(0, MAX_RAW_TEXT)

  function matchedSnippet(text: string, pattern: RegExp, contextChars = 40): string {
    const match = text.match(pattern)
    if (!match) return ''
    const idx = match.index!
    const start = Math.max(0, idx - contextChars)
    const end = Math.min(text.length, idx + match[0].length + contextChars)
    const prefix = start > 0 ? '…' : ''
    const suffix = end < text.length ? '…' : ''
    return `${prefix}"${text.slice(start, end).trim()}"${suffix}`
  }

  for (const { pattern, label } of PLACEHOLDER_PATTERNS) {
    const match = sampleText.match(pattern)
    if (match) {
      findings.push({
        checkId: 'placeholder-copy-detected',
        rubric: 'MESSAGE',
        impactTag: 'CONVERSION',
        severity: 'IMPORTANT',
        problem: 'Placeholder or unfinished copy detected on the page',
        evidence: `Found ${label}: ${matchedSnippet(sampleText, pattern)}`,
        fix: '1. Replace placeholder text with product-specific copy\n2. Review the entire page for any remaining placeholder content\n3. Test the live page to confirm no placeholder text is visible',
        confidence: 0.95,
        source: 'DETERMINISTIC',
      })
      break
    }
  }

  // Headings and title only: template defaults live in the headline, and matching
  // body prose produced false positives on legitimate copy.
  const headingText = [meta.title ?? '', ...meta.h1s].join(' • ')
  for (const { pattern, label } of TEMPLATE_COPY_PATTERNS) {
    const match = headingText.match(pattern)
    if (match) {
      findings.push({
        checkId: 'template-default-copy',
        rubric: 'MESSAGE',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'Template or generic default copy detected',
        evidence: `Found "${label}" in the page heading: ${matchedSnippet(headingText, pattern)}`,
        fix: '1. Replace generic template copy with a specific headline\n2. Name the product, audience, and outcome in the headline\n3. Review other sections for template defaults (CTAs, subheadings)',
        confidence: 0.85,
        source: 'DETERMINISTIC',
      })
      break
    }
  }

  for (const { pattern, label } of AI_BUILDER_PATTERNS) {
    const match = sampleText.match(pattern)
    if (match) {
      findings.push({
        checkId: 'placeholder-copy-detected',
        rubric: 'MESSAGE',
        impactTag: 'TRUST',
        severity: 'IMPORTANT',
        problem: 'AI-builder template artifact visible on the page',
        evidence: `Found ${label}: ${matchedSnippet(sampleText, pattern)}`,
        fix: '1. Replace auto-generated template text with original product copy\n2. Remove any "Built with X" watermarks or builder labels\n3. Remove in-place editor instructions like "Click to edit"\n4. Fill in any "Add your…" placeholder sections with real content',
        confidence: 0.9,
        source: 'DETERMINISTIC',
      })
      break
    }
  }

  const tokenMatch = sampleText.match(TEMPLATE_TOKEN_PATTERN)
  if (tokenMatch) {
    findings.push({
      checkId: 'unreplaced-template-token',
      rubric: 'MESSAGE',
      impactTag: 'TRUST',
      severity: 'CRITICAL',
      problem: 'Unreplaced template token visible on the page',
      evidence: `Found unreplaced token: "${tokenMatch[0].slice(0, 80)}" in "${sampleText.slice(Math.max(0, tokenMatch.index! - 20), tokenMatch.index! + tokenMatch[0].length + 20).trim()}"`,
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
      evidence: `Found "${socialSlop.matched}" - ${socialSlop.label}`,
      fix: '1. Replace fake stats with real, verifiable numbers\n2. Replace logo placeholders with actual customer logos\n3. Replace anonymous testimonials with real quotes with named attribution',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
