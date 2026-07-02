import { PageMetadata } from '../metadata'
import { DeterministicFlag } from './index'

export function runMetadataChecks(meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (!meta.title) {
    findings.push({
      checkId: 'title-missing',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'CRITICAL',
      problem: 'Page title is missing',
      evidence: 'No <title> tag found in <head>',
      fix: '1. Add a descriptive <title> tag (50-60 characters) to the <head>\n2. Include the primary keyword and brand name\n3. Verify the title is unique across pages',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.title.length < 10) {
    findings.push({
      checkId: 'title-too-short',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'IMPORTANT',
      problem: `Page title is too short (${meta.title.length} chars)`,
      evidence: `Title: "${meta.title}"`,
      fix: '1. Expand the title to 50-60 characters\n2. Place the primary keyword near the start\n3. Include the brand name at the end',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.title.length > 60) {
    findings.push({
      checkId: 'title-too-long',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: `Page title is too long (${meta.title.length} chars, will truncate at ~60)`,
      evidence: `Title: "${meta.title}"`,
      fix: '1. Shorten the title to under 60 characters\n2. Keep the primary keyword near the start\n3. Keep the brand name if it fits',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.description) {
    findings.push({
      checkId: 'description-missing',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'IMPORTANT',
      problem: 'Meta description is missing',
      evidence: 'No <meta name="description"> tag found',
      fix: '1. Add a meta description (120-160 characters) summarizing the page content\n2. Include a call to action and primary keywords\n3. Verify it appears in search snippet previews',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.description.length < 50) {
    findings.push({
      checkId: 'description-too-short',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: `Meta description is too short (${meta.description.length} chars)`,
      evidence: `Description: "${meta.description}"`,
      fix: '1. Expand the meta description to 120-160 characters\n2. Describe what users get and include a CTA\n3. Avoid keyword stuffing',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.description.length > 160) {
    findings.push({
      checkId: 'description-too-long',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: `Meta description is too long (${meta.description.length} chars, will truncate at ~160)`,
      evidence: `Description: "${meta.description.slice(0, 80)}..."`,
      fix: '1. Shorten the meta description to under 160 characters\n2. Keep the key value prop and CTA in the visible portion\n3. Avoid truncation in search results',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.ogImage) {
    findings.push({
      checkId: 'og-image-missing',
      rubric: 'REACH',
      impactTag: 'SHARING',
      severity: 'IMPORTANT',
      problem: 'og:image is missing, link previews show blank',
      evidence: 'No <meta property="og:image"> tag found in <head>',
      fix: '1. Open your page metadata export (layout.tsx or page.tsx)\n2. Add openGraph: { images: [\'https://yourdomain.com/og.png\'] }\n3. Generate a 1200x630px PNG with your branding or product screenshot',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.ogTitle) {
    findings.push({
      checkId: 'og-title-missing',
      rubric: 'REACH',
      impactTag: 'SHARING',
      severity: 'POLISH',
      problem: 'og:title is missing',
      evidence: 'No <meta property="og:title"> tag found',
      fix: '1. Add <meta property="og:title" content="..."> to the page head\n2. Set it to match the page title (50-60 characters)\n3. Verify it renders correctly in the Twitter Card validator',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.ogDescription) {
    findings.push({
      checkId: 'og-description-missing',
      rubric: 'REACH',
      impactTag: 'SHARING',
      severity: 'POLISH',
      problem: 'og:description is missing',
      evidence: 'No <meta property="og:description"> tag found',
      fix: '1. Add <meta property="og:description"> to the page head\n2. Set it to match the meta description\n3. Keep it under 200 characters for clean link previews',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.viewport) {
    findings.push({
      checkId: 'viewport-missing',
      rubric: 'EXPERIENCE',
      severity: 'CRITICAL',
      problem: 'Viewport meta tag is missing',
      evidence: 'No <meta name="viewport"> found',
      fix: '1. Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>\n2. Remove any other viewport meta tags that conflict\n3. Test mobile rendering at 375px width',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.lang) {
    findings.push({
      checkId: 'lang-missing',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: 'HTML lang attribute is missing',
      evidence: '<html> tag does not have a lang attribute',
      fix: '1. Add lang="en" (or the appropriate language code) to the <html> element\n2. Match the language of the page content\n3. Verify screen reader pronunciation with VoiceOver',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.canonical) {
    findings.push({
      checkId: 'canonical-missing',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: 'Canonical URL is missing',
      evidence: 'No <link rel="canonical"> found in <head>',
      fix: '1. Add <link rel="canonical" href="https://yourdomain.com/page"> to <head>\n2. Use the absolute URL matching exactly what Google should index\n3. Ensure the canonical URL returns 200, not a redirect',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.robots?.toLowerCase().includes('noindex')) {
    findings.push({
      checkId: 'robots-blocks-indexing',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'CRITICAL',
      problem: 'Robots meta tag is blocking indexing',
      evidence: `<meta name="robots" content="${meta.robots}">`,
      fix: '1. Find the robots meta tag in <head> or metadata export\n2. Remove "noindex" from the content attribute\n3. Verify the page appears in Google Search Console after re-crawl',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.hasFavicon) {
    findings.push({
      checkId: 'favicon-missing',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: 'Favicon is missing',
      evidence: 'No link rel="icon" or apple-touch-icon found in <head>',
      fix: '1. Generate a 32x32 PNG or ICO favicon\n2. Add <link rel="icon" href="/favicon.ico"> to <head>\n3. Add <link rel="apple-touch-icon" href="/apple-touch-icon.png"> for iOS',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}

export async function runOgImageUrlCheck(
  pageUrl: string,
  meta: PageMetadata
): Promise<DeterministicFlag[]> {
  if (!meta.ogImage) return []

  let imageUrl: string
  try {
    imageUrl = new URL(meta.ogImage, pageUrl).toString()
  } catch {
    return [
      {
        checkId: 'og-image-broken',
        rubric: 'REACH',
        impactTag: 'SHARING',
        severity: 'IMPORTANT',
        problem: 'og:image URL is invalid',
        evidence: `og:image content="${meta.ogImage}" could not be resolved`,
        fix: '1. Set og:image to an absolute HTTPS URL that returns a valid image\n2. Use a 1200x630px PNG or JPG\n3. Verify the URL returns 200 and Content-Type is an image type',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      },
    ]
  }

  try {
    const headController = new AbortController()
    const headTimer = setTimeout(() => headController.abort(), 5000)
    const res = await fetch(imageUrl, { method: 'HEAD', signal: headController.signal })
    clearTimeout(headTimer)
    if (res.ok) return []

    const getController = new AbortController()
    const getTimer = setTimeout(() => getController.abort(), 5000)
    const getRes = await fetch(imageUrl, {
      method: 'GET',
      signal: getController.signal,
      headers: { Range: 'bytes=0-0' },
    })
    clearTimeout(getTimer)
    if (getRes.ok) return []
  } catch {
    // og:image HEAD/GET failed, fall through to flag
  }

  return [
    {
      checkId: 'og-image-broken',
      rubric: 'REACH',
      impactTag: 'SHARING',
      severity: 'IMPORTANT',
      problem: 'og:image URL does not load',
      evidence: `HEAD/GET ${imageUrl} failed or returned an error status`,
      fix: '1. Fix the og:image URL so it returns 200 with a valid image\n2. Check CDN permissions, bucket policies, and absolute paths\n3. Verify the Content-Type header matches the image format',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    },
  ]
}
