import { PageMetadata } from '../metadata'
import { DeterministicFinding } from './index'

export function runMetadataChecks(meta: PageMetadata): DeterministicFinding[] {
  const findings: DeterministicFinding[] = []

  if (!meta.title) {
    findings.push({
      checkId: 'title-missing',
      area: 'SEO',
      severity: 'CRITICAL',
      problem: 'Page title is missing',
      evidence: 'No <title> tag found in <head>',
      fix: 'Add a descriptive <title> tag (50–60 characters) to the <head>',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.title.length < 10) {
    findings.push({
      checkId: 'title-too-short',
      area: 'SEO',
      severity: 'HIGH',
      problem: `Page title is too short (${meta.title.length} chars)`,
      evidence: `Title: "${meta.title}"`,
      fix: 'Expand the title to 50–60 characters. Include the primary keyword and brand name.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.title.length > 60) {
    findings.push({
      checkId: 'title-too-long',
      area: 'SEO',
      severity: 'MEDIUM',
      problem: `Page title is too long (${meta.title.length} chars, will truncate at ~60)`,
      evidence: `Title: "${meta.title}"`,
      fix: 'Shorten the title to under 60 characters. Keep the primary keyword near the start.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.description) {
    findings.push({
      checkId: 'description-missing',
      area: 'SEO',
      severity: 'HIGH',
      problem: 'Meta description is missing',
      evidence: 'No <meta name="description"> tag found',
      fix: 'Add a meta description (120–160 characters) summarizing the page content and including a call to action.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.description.length < 50) {
    findings.push({
      checkId: 'description-too-short',
      area: 'SEO',
      severity: 'MEDIUM',
      problem: `Meta description is too short (${meta.description.length} chars)`,
      evidence: `Description: "${meta.description}"`,
      fix: 'Expand the meta description to 120–160 characters. Describe what users get and include a CTA.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.description.length > 160) {
    findings.push({
      checkId: 'description-too-long',
      area: 'SEO',
      severity: 'MEDIUM',
      problem: `Meta description is too long (${meta.description.length} chars, will truncate at ~160)`,
      evidence: `Description: "${meta.description.slice(0, 80)}..."`,
      fix: 'Shorten the meta description to under 160 characters.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.ogImage) {
    findings.push({
      checkId: 'og-image-missing',
      area: 'SEO',
      severity: 'HIGH',
      problem: 'og:image is missing, link previews show blank',
      evidence: 'No <meta property="og:image"> tag found in <head>',
      fix: 'Add a 1200×630px og:image. For Next.js, add it to the metadata export in your page.tsx.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.ogTitle) {
    findings.push({
      checkId: 'og-title-missing',
      area: 'SEO',
      severity: 'MEDIUM',
      problem: 'og:title is missing',
      evidence: 'No <meta property="og:title"> tag found',
      fix: 'Add <meta property="og:title" content="..."> to your page head.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.ogDescription) {
    findings.push({
      checkId: 'og-description-missing',
      area: 'SEO',
      severity: 'LOW',
      problem: 'og:description is missing',
      evidence: 'No <meta property="og:description"> tag found',
      fix: 'Add <meta property="og:description">, usually the same as the meta description.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.viewport) {
    findings.push({
      checkId: 'viewport-missing',
      area: 'MOBILE',
      severity: 'CRITICAL',
      problem: 'Viewport meta tag is missing',
      evidence: 'No <meta name="viewport"> found',
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.lang) {
    findings.push({
      checkId: 'lang-missing',
      area: 'ACCESSIBILITY',
      severity: 'MEDIUM',
      problem: 'HTML lang attribute is missing',
      evidence: '<html> tag does not have a lang attribute',
      fix: 'Add lang="en" (or the appropriate language code) to the <html> element.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.canonical) {
    findings.push({
      checkId: 'canonical-missing',
      area: 'SEO',
      severity: 'MEDIUM',
      problem: 'Canonical URL is missing',
      evidence: 'No <link rel="canonical"> found in <head>',
      fix: 'Add <link rel="canonical" href="https://yourdomain.com/page"> to prevent duplicate content issues.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.robots?.toLowerCase().includes('noindex')) {
    findings.push({
      checkId: 'robots-blocks-indexing',
      area: 'SEO',
      severity: 'CRITICAL',
      problem: 'Robots meta tag is blocking indexing',
      evidence: `<meta name="robots" content="${meta.robots}">`,
      fix: 'Remove "noindex" from the robots meta tag to allow search engines to index this page.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
