import type { RuntimeHeadMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { safeFetchResource } from '../url'
import { previewImageResponse, PREVIEW_IMAGE_MAX_BYTES, type PreviewImageResponse } from './preview-image-response'
import { QUALITATIVE_GUIDANCE_COPY as C } from '@/lib/marketing/copy/qualitative-guidance'
import { destinationContext, displayDestination, destinationScope, DESTINATION_VERIFICATION_RULE, type DestinationCheckOptions } from './destination-evidence'

export function runMetadataChecks(meta: RuntimeHeadMetadata, record?: (assertion: CheckAssertion) => void): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  // Record only the presence assertions actually evaluated here. These are
  // bounded observations, not claims about search ranking or rendered previews.
  for (const [key, name, value] of [
    ['title-presence', 'Page title is specified', meta.title],
    ['description-presence', 'Meta description is specified', meta.description],
    ['preview-image-presence', 'Link preview image is specified', meta.ogImage],
    ['preview-title-presence', 'Link preview title is specified', meta.ogTitle],
    ['preview-description-presence', 'Link preview description is specified', meta.ogDescription],
    ['favicon-presence', 'A favicon is declared', meta.hasFavicon],
    ['viewport-presence', 'Mobile viewport is declared', meta.viewport],
    ['language-presence', 'Page language is declared', meta.lang],
  ] as const) {
    record?.({ key, name, expected: name, observed: value === undefined ? 'This head field could not be observed.'
      : value ? 'Present in captured page metadata' : 'Absent from captured page metadata', passed: Boolean(value), complete: value !== undefined })
  }

  if (meta.title !== undefined && !meta.title) {
    findings.push({
      checkId: 'title-missing',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'CRITICAL',
      problem: 'Page title is missing',
      evidence: 'No <title> tag found in <head>',
      fix: 'Add a descriptive title that matches this page. Google may shorten or rewrite its displayed title link.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.title && meta.title.length < 10) {
    findings.push({
      checkId: 'title-too-short',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'IMPORTANT',
      problem: `Review this brief page title (${meta.title.length} characters)`,
      evidence: `Title is ${meta.title.length} characters: "${meta.title}". Length alone does not establish a failure.`,
      fix: 'Review whether the title accurately identifies this page. Google specifies no fixed character limit.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.title && meta.title.length > 60) {
    findings.push({
      checkId: 'title-too-long',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: `Page title may be verbose (${meta.title.length} characters)`,
      evidence: `Title is ${meta.title.length} characters: "${meta.title}". Search display depends on device width; there is no fixed character limit.`,
      fix: '1. Review whether the title clearly describes this page\n2. Put its most useful information first\n3. Remove unnecessary repetition; displayed title links may be shortened or rewritten',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.description !== undefined && !meta.description) {
    findings.push({
      checkId: 'description-missing',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'IMPORTANT',
      problem: 'Meta description is missing',
      evidence: 'No <meta name="description"> tag found',
      fix: 'Describe the page accurately and concisely. Google may choose another snippet for a query.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.description && meta.description.length < 50) {
    findings.push({
      checkId: 'description-too-short',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: `Review this brief page description (${meta.description.length} characters)`,
      evidence: `Description is ${meta.description.length} characters: "${meta.description}". There is no fixed Google character requirement.`,
      fix: 'Review whether this description usefully summarizes the page without keyword stuffing.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.description && meta.description.length > 160) {
    findings.push({
      checkId: 'description-too-long',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: `Meta description may be verbose (${meta.description.length} characters)`,
      evidence: `Description is ${meta.description.length} characters: "${meta.description.slice(0, 80)}...". Search snippets vary by query and device width; there is no fixed character limit.`,
      fix: '1. Describe the page accurately and concisely\n2. Put its most useful information first\n3. Remove unnecessary repetition; Google may choose a different snippet for a query',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.ogImage !== undefined && !meta.ogImage) {
    findings.push({
      checkId: 'og-image-missing',
      rubric: 'REACH',
      impactTag: 'SHARING',
      severity: 'IMPORTANT',
      problem: 'No image is specified for link previews',
      evidence: 'No <meta property="og:image"> tag found in <head>. A sharing service may choose a fallback; its rendered preview was not tested.',
      fix: C.previewImage,
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.ogTitle !== undefined && !meta.ogTitle) {
    findings.push({
      checkId: 'og-title-missing',
      rubric: 'REACH',
      impactTag: 'SHARING',
      severity: 'POLISH',
      problem: 'og:title is missing',
      evidence: 'No <meta property="og:title"> tag found',
      fix: C.previewTitle,
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.ogDescription !== undefined && !meta.ogDescription) {
    findings.push({
      checkId: 'og-description-missing',
      rubric: 'REACH',
      impactTag: 'SHARING',
      severity: 'POLISH',
      problem: 'og:description is missing',
      evidence: 'No <meta property="og:description"> tag found',
      fix: C.previewDescription,
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.viewport !== undefined && !meta.viewport) {
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

  if (meta.lang !== undefined && !meta.lang) {
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

  if (meta.canonical !== undefined && !meta.canonical) {
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

  if (meta.hasFavicon === false) {
    findings.push({
      checkId: 'favicon-missing',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: 'No favicon link is declared',
      evidence: 'No link rel="icon" or apple-touch-icon found in <head>',
      fix: C.favicon,
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}

export async function runOgImageUrlCheck(
  pageUrl: string,
  meta: { ogImage?: string | null; linkBaseUrl?: string },
  options: DestinationCheckOptions = {},
): Promise<DeterministicFlag[]> {
  const limitation = 'A bounded public GET observes response facts and first-frame PNG, JPEG, WebP or GIF decoding within 5MB, 16 million pixels and the execution budget. Unsupported formats and incomplete decoding remain unknown. Sharing-platform rendering, later animation frames and caches were not evaluated.'
  if (meta.ogImage === undefined) {
    options.record?.({ key: 'preview-image-response', name: 'Link preview image response',
      expected: 'The declared image destination returns a successful GET response with image content type and content',
      observed: 'The image declaration could not be observed.', passed: false, complete: false })
    destinationScope(options, false, limitation)
    return []
  }
  if (!meta.ogImage) { destinationScope(options, true, limitation); return [] }
  let imageUrl: string
  let invalid = false
  try { imageUrl = new URL(meta.ogImage, meta.linkBaseUrl ?? pageUrl).toString() }
  catch { imageUrl = meta.ogImage; invalid = true }
  let complete = invalid, responseComplete = invalid, passed = false, broken = invalid, imageEligible = false
  let decoding: PreviewImageResponse['decoding']
  let observed = 'The declared image URL could not be resolved.'
  if (!invalid) {
    try {
      const init = { timeoutMs: 5000, deadline: options.deadline, maxBytes: PREVIEW_IMAGE_MAX_BYTES, accept: 'image/*' }
      const response = options.observeImage ? await options.observeImage(imageUrl, init)
        : await previewImageResponse(await (options.fetchDocument ?? safeFetchResource)(imageUrl, init), options.deadline)
      const status = response.statusCode, contentType = response.contentType, restricted = response.restriction !== null
      imageEligible = !restricted && status >= 200 && status < 300 && /^image\//.test(contentType) && response.hasContent
      decoding = response.decoding
      passed = imageEligible && decoding?.state !== 'invalid'
      broken = !restricted && (status >= 400 || status >= 200 && status < 300 &&
        (Boolean(contentType) && !/^image\//.test(contentType) || response.complete && !response.hasContent)) || imageEligible && decoding?.state === 'invalid'
      responseComplete = passed || broken
      complete = responseComplete && (!imageEligible || decoding?.state === 'decoded' || decoding?.state === 'invalid')
      observed = `GET HTTP ${status}${contentType ? `, ${contentType.slice(0, 120)}` : ', no content type'}. ${restricted ? 'Access to the normal image response was not established. ' : ''}${limitation}`
    } catch { observed = 'No public image response was obtained. Network errors and scanner refusals remain unknown.' }
  }
  const context = destinationContext(pageUrl, imageUrl)
  options.record?.({ key: 'preview-image-response', name: 'Link preview image response',
    expected: 'The declared image destination returns a successful GET response with image content type, content and no observed decoding failure',
    observed, passed, complete: responseComplete, context })
  const decodingContext = destinationContext(pageUrl, imageUrl, 'preview-image-decoding-v1')
  const decodingObserved = decoding?.state === 'decoded'
    ? `The ${decoding.format} first frame decoded from the collected bytes (${decoding.width} × ${decoding.height}).`
    : decoding?.state === 'invalid' ? `The collected ${decoding.format} bytes could not be decoded.`
      : `Image decoding remains unknown (${decoding?.reason ?? 'byte_evidence_unavailable'}).`
  if (imageEligible) options.record?.({ key: 'preview-image-decoding', name: 'Link preview image decoding',
    expected: 'The original image destination supplies decodable pixels under the recorded raster policy',
    observed: decodingObserved, passed: decoding?.state === 'decoded',
    complete: decoding?.state === 'decoded' || decoding?.state === 'invalid', context: decodingContext })
  destinationScope(options, complete, limitation)
  if (!broken) return []
  const decodingFailed = imageEligible && decoding?.state === 'invalid'
  return [{
    checkId: 'og-image-broken', rubric: 'REACH', impactTag: 'SHARING', severity: 'IMPORTANT',
    problem: invalid ? 'og:image URL is invalid' : decodingFailed ? 'Link preview image data could not be decoded' : 'og:image URL does not load',
    evidence: `${displayDestination(imageUrl)}: ${decodingFailed ? decodingObserved + ' ' : ''}${observed}`,
    fix: '1. Fix the og:image URL so it returns 200 with a valid image\n2. Check CDN permissions, bucket policies, and absolute paths\n3. Verify the Content-Type header matches the image format',
    confidence: 1.0, source: 'DETERMINISTIC', verificationRule: DESTINATION_VERIFICATION_RULE,
    evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop', label: 'Link preview image response', context: decodingFailed ? decodingContext : context }],
  }]
}
