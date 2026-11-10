import type { RuntimeHeadMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { safeFetchResource } from '../url'
import { collectPreviewImageResponse, PREVIEW_IMAGE_MAX_BYTES, type PreviewImageResponse } from './preview-image-response'
import { QUALITATIVE_GUIDANCE_COPY as C } from '@/lib/marketing/copy/qualitative-guidance'
import { destinationContext, displayDestination, destinationScope, DESTINATION_VERIFICATION_RULE, type DestinationCheckOptions } from './destination-evidence'
import { captureObservationKey, type CaptureObservationScope } from '../browser/observation-scope'
import { PUBLIC_PREVIEW_VERIFICATION_RULE } from './preview-contract'
import type { PublicPagePreview } from './public-page-preview'
import { isSuccessfulPublicGetStatus } from '../http-evidence'

type PreviewFields = Pick<RuntimeHeadMetadata, 'ogImage' | 'ogTitle' | 'ogDescription'>
const previewFields = [
  { field: 'ogImage', key: 'preview-image-presence', checkId: 'og-image-missing', tag: 'og:image', name: 'Link preview image is specified',
    problem: 'No image is specified for link previews', fix: C.previewImage, severity: 'IMPORTANT' },
  { field: 'ogTitle', key: 'preview-title-presence', checkId: 'og-title-missing', tag: 'og:title', name: 'Link preview title is specified',
    problem: 'No title is specified for link previews', fix: C.previewTitle, severity: 'POLISH' },
  { field: 'ogDescription', key: 'preview-description-presence', checkId: 'og-description-missing', tag: 'og:description', name: 'Link preview description is specified',
    problem: 'No description is specified for link previews', fix: C.previewDescription, severity: 'POLISH' },
] as const

export function runPreviewDeclarationChecks(meta: PreviewFields, record?: (assertion: CheckAssertion) => void, scope?: PublicPagePreview['scope'],
  checks?: Readonly<Record<string, number>>) {
  const findings: DeterministicFlag[] = []
  const context = scope ? destinationContext(scope.pageUrl, scope.finalUrl, 'public-preview-head-v1') : undefined
  for (const { field, key, checkId, tag, name, problem, fix, severity } of previewFields) {
    if (checks && !checks[checkId]) continue
    const value = meta[field]
    const source = context ? 'the public HTML head' : 'the captured page metadata'
    record?.({ key, name, expected: name, observed: value === undefined ? 'The preview declaration could not be inspected.'
      : value ? `Present in ${source}.` : `Absent from ${source}.`, passed: Boolean(value), complete: value !== undefined, context })
    if (value === undefined || value) continue
    findings.push({ checkId, rubric: 'REACH', impactTag: 'SHARING', severity, problem,
      evidence: `${context ? 'The public HTML head' : 'The captured page metadata'} has no non-empty ${tag} declaration.`, fix, confidence: 1, source: 'DETERMINISTIC',
      ...(context ? { verificationRule: PUBLIC_PREVIEW_VERIFICATION_RULE, evidenceTargets: [{ kind: 'page', source: 'measured',
        device: 'desktop', label: 'Public HTML head', context }] } : {}) })
  }
  return findings
}

export function runMetadataChecks(meta: RuntimeHeadMetadata, record?: (assertion: CheckAssertion) => void, includeRenderedPreview = true): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  // Record only the presence assertions actually evaluated here. These are
  // bounded observations, not claims about search ranking or rendered previews.
  for (const [key, name, value] of [
    ['title-presence', 'Page title is specified', meta.title],
    ['description-presence', 'Meta description is specified', meta.description],
    ['favicon-presence', 'A favicon link supplies an icon address', meta.hasFavicon],
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
      fix: '1. Rewrite the title so it describes this page, with the most useful words first\n2. Remove repeated words and site-wide filler\n3. Expect search results to shorten or rewrite displayed titles',
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

  if (includeRenderedPreview) findings.push(...runPreviewDeclarationChecks(meta, record))

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
      problem: 'No usable favicon link is declared',
      evidence: 'The page head needs an icon link with a non-empty address for an image resource.',
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
  publicScope?: CaptureObservationScope,
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
  try {
    const resolved = new URL(meta.ogImage, meta.linkBaseUrl ?? pageUrl)
    imageUrl = resolved.href
    invalid = Boolean(publicScope && (!['https:', 'http:'].includes(resolved.protocol) || resolved.username || resolved.password))
  }
  catch { imageUrl = meta.ogImage; invalid = true }
  let complete = invalid, responseComplete = invalid, passed = false, broken = invalid, imageEligible = false
  let decoding: PreviewImageResponse['decoding']
  let observed = 'The declared image URL could not be resolved.'
  if (!invalid) {
    try {
      const init = { timeoutMs: 5000, deadline: options.deadline, maxBytes: PREVIEW_IMAGE_MAX_BYTES, accept: 'image/*' }
      const response = options.observeImage ? await options.observeImage(imageUrl, init)
        : await collectPreviewImageResponse(() => (options.fetchDocument ?? safeFetchResource)(imageUrl, init), options.deadline)
      const status = response.statusCode, contentType = response.contentType, restricted = response.restriction !== null
      const successful = publicScope ? isSuccessfulPublicGetStatus(status) : status >= 200 && status < 300
      imageEligible = !restricted && successful && /^image\//.test(contentType) && response.hasContent
      decoding = response.decoding
      passed = imageEligible && (publicScope ? decoding?.state === 'decoded' : decoding?.state !== 'invalid')
      broken = !restricted && (status >= 400 || successful &&
        (Boolean(contentType) && !/^image\//.test(contentType) || response.complete && !response.hasContent)) || imageEligible && decoding?.state === 'invalid'
      responseComplete = passed || broken
      complete = responseComplete && (!imageEligible || decoding?.state === 'decoded' || decoding?.state === 'invalid')
      observed = `GET HTTP ${status}${contentType ? `, ${contentType.slice(0, 120)}` : ', no content type'}. ${restricted ? 'Access to the normal image response was not established. ' : ''}${limitation}`
    } catch { observed = 'No public image response was obtained. Network errors and scanner refusals remain unknown.' }
  }
  const publicIdentity = publicScope ? captureObservationKey(publicScope) : undefined
  const syntaxContext = publicScope ? destinationContext(publicScope.pageUrl, publicScope.finalUrl, 'public-preview-image-url-v2') : undefined
  const context = invalid && syntaxContext ? syntaxContext
    : destinationContext(pageUrl, imageUrl, publicIdentity ? 'public-preview-image-v2:' + publicIdentity : undefined)
  options.record?.({ key: 'preview-image-response', name: 'Link preview image response',
    expected: publicScope ? 'The published image URL returns image bytes that decode under the supported policy'
      : 'The declared image destination returns a successful GET response with image content type, content and no observed decoding failure',
    observed, passed, complete: responseComplete, context,
    ...(syntaxContext ? { targets: [{ selector: 'meta[property="og:image"], meta[property="og:image:url"]',
      label: 'Published image address', context: syntaxContext }] } : {}) })
  const decodingContext = destinationContext(pageUrl, imageUrl, publicIdentity ? 'public-preview-image-decoding-v2:' + publicIdentity : 'preview-image-decoding-v1')
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
    evidence: invalid && publicScope ? 'The public HTML head declares an image address that cannot be opened over HTTP or HTTPS.'
      : `${displayDestination(imageUrl)}: ${decodingFailed ? decodingObserved + ' ' : ''}${observed}`,
    fix: invalid && publicScope ? 'Publish a valid HTTP or HTTPS image address in the page’s HTML head. Check that it opens the intended image.'
      : '1. Fix the og:image URL so it returns 200 with a valid image\n2. Check CDN permissions, bucket policies, and absolute paths\n3. Verify the Content-Type header matches the image format',
    confidence: 1.0, source: 'DETERMINISTIC', verificationRule: DESTINATION_VERIFICATION_RULE,
    evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop', label: 'Link preview image response', context: decodingFailed ? decodingContext : context }],
  }]
}
