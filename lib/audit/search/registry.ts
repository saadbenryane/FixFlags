import { searchSectionBody, type SearchSection } from './rendered-snapshot'
import * as cheerio from 'cheerio'
import robotsParser from 'robots-parser'
import type { DeterministicFlag } from '../flag-types'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'
import { parseSitemap } from './collect'
import { SEARCH_DEFINITIONS, SEARCH_CHECK_REGISTRY } from './definitions'
import { inspectStructuredData, inspectFeature, entityValues } from './structured-data'
import { searchObservationSchema, type PublicDocument, type SearchPageEvidence, type SearchObservation, type SearchReceipt } from './contracts'
import { pageScopedSearchAttention } from './attention-scope'
import { canonicalDeclarations } from './canonical-declarations'

type Rule = keyof typeof C.rules
type EvaluatorInput = { evidence: SearchPageEvidence; previous?: SearchReceipt | null }
type Definition = {
  id: string; version: 2; responsibility: SearchObservation['responsibility'];
  checkIds: readonly string[]; resultSchema: 'search-observation-v2'; guidance: Rule;
  requiredEvidence: readonly string[]; assertions: readonly string[];
  evaluate: (input: EvaluatorInput) => SearchObservation[] | Promise<SearchObservation[]>;
}
type ObservationInput = Omit<Partial<SearchObservation>, 'attention'> & {
  checkId: string; rule: Rule; source: SearchObservation['source'];
  disposition: SearchObservation['disposition']; reason: string; observed: string;
  attention?: SearchObservation['attention']['kind']; document?: PublicDocument; locator?: string; excerpt?: string;
}

function observation(evidence: SearchPageEvidence, input: ObservationInput): SearchObservation {
  const definition = C.rules[input.rule], document = input.document
  return searchObservationSchema.parse({
    id: input.id ?? `${input.checkId}:${input.source}`, checkId: input.checkId, checkVersion: evidence.collectorVersion ?? (evidence.rendered.searchSnapshot ? 2 : 1),
    responsibility: input.responsibility ?? 'presentation', name: input.name ?? definition.name,
    disposition: input.disposition, reason: input.reason, expected: input.expected ?? definition.expected,
    observed: input.observed, source: input.source, collectedAt: document?.collectedAt ?? evidence.collectedAt,
    pageUrl: evidence.pageUrl, attention: { policy: 'search', version: evidence.collectorVersion ?? (evidence.rendered.searchSnapshot ? 2 : 1), kind: input.attention ?? 'observation', reason: input.reason },
    evidence: input.evidence ?? [{ source: input.source, url: document?.finalUrl ?? evidence.pageUrl,
      locator: input.locator ?? input.checkId, excerpt: (input.excerpt ?? input.observed).slice(0, 2000),
      collectedAt: document?.collectedAt ?? evidence.collectedAt }],
    limitation: input.limitation ?? C.localLimit, guidance: input.guidance ?? definition.guidance,
    entityTypes: input.entityTypes,
    entityId: input.entityId, invalidProperties: input.invalidProperties,
  })
}

function html(document: PublicDocument, section: SearchSection = 'metadata') {
  const body = searchSectionBody(document, section)
  return body == null ? null : cheerio.load(body)
}
function primary(evidence: SearchPageEvidence, section: SearchSection = 'metadata'): [PublicDocument, 'original-html' | 'rendered-dom'] {
  return html(evidence.rendered, section) ? [evidence.rendered, 'rendered-dom'] : [evidence.original, 'original-html']
}
function urlIdentity(value: string): string { try { const url = new URL(value); url.hash = ''; return url.toString() } catch { return value } }
function unknown(evidence: SearchPageEvidence, checkId: string, responsibility: SearchObservation['responsibility'], rule: Rule, source: SearchObservation['source']) {
  const document = source === 'original-html' ? evidence.original : source === 'rendered-dom' ? evidence.rendered
    : source === 'robots-txt' ? evidence.robots : source === 'sitemap' ? evidence.sitemaps.find(item => !item.complete) : undefined
  const reason = !evidence.public ? 'private_capture' : document?.status != null && (document.status < 200 || document.status >= 300)
    ? 'content_response_not_successful' : document?.reason ?? 'required_evidence_unavailable'
  return observation(evidence, { checkId, responsibility, rule, source, document, disposition: 'unknown', reason,
    observed: reason === 'private_capture' ? 'A credentialed capture cannot establish publicly available Search evidence.'
      : reason === 'document_truncated' ? 'The document exceeded the inspection limit. Absence and success were not established.' : C.unknown })
}

function presentation({ evidence }: EvaluatorInput): SearchObservation[] {
  const [document, source] = primary(evidence), $ = html(document)
  if (!$) return [unknown(evidence, 'title-missing', 'presentation', 'title', source), unknown(evidence, 'description-missing', 'presentation', 'description', source)]
  const title = $('head title').first().text().trim(), description = $('meta[name]').filter((_, node) => ($(node).attr('name') ?? '').toLowerCase() === 'description').first().attr('content')?.trim()
  const observations = [observation(evidence, { checkId: 'title-missing', rule: 'title', source, document,
    disposition: title ? 'passed' : 'failed', reason: title ? 'title_present' : 'title_empty', observed: title || 'No non-empty title was recorded.',
    attention: title ? 'observation' : 'flag', locator: 'head title' }),
  observation(evidence, { checkId: 'description-missing', rule: 'description', source, document,
    disposition: description ? 'passed' : 'observed', reason: description ? 'description_present' : 'description_absent',
    observed: description || 'No page description was recorded.', attention: description ? 'observation' : 'recommendation', locator: 'meta[name="description"]' })]
  const language = $('html').attr('lang')?.trim()
  observations.push(observation(evidence, { checkId: 'search-page-language', rule: 'language', source, document,
    disposition: 'observed', reason: language ? 'page_language_recorded' : 'page_language_absent',
    observed: language ?? 'No page language was declared in this source. Accessibility is reviewed separately.', locator: 'html[lang]' }))
  const textHtml = html(document, 'text')
  const headings = [...new Set((textHtml ?? $)('h1').map((_, node) => $(node).text().trim()).get().filter(Boolean))]
  observations.push(observation(evidence, { checkId: headings.length > 1 ? 'h1-multiple' : 'h1-missing', rule: 'headings', source, document,
    disposition: !textHtml ? 'unknown' : headings.length === 1 ? 'passed' : 'observed', reason: !textHtml ? 'text_section_incomplete' : headings.length ? 'headings_recorded' : 'main_heading_absent',
    observed: headings.length ? headings.slice(0, 4).join(' | ') : 'No non-empty H1 was recorded.',
    attention: !textHtml || headings.length === 1 ? 'observation' : 'recommendation', locator: 'h1' }))
  for (const [other, otherSource] of [[evidence.original, 'original-html'], [evidence.rendered, 'rendered-dom']] as const) {
    if (otherSource === source) continue
    const otherHtml = html(other)
    if (otherHtml) {
      const otherTitle = otherHtml('head title').first().text().trim()
      observations.push(observation(evidence, { checkId: 'title-missing', rule: 'title', source: otherSource, document: other,
        disposition: otherTitle ? 'passed' : 'failed', reason: otherTitle ? 'title_present' : 'title_empty',
        observed: otherTitle || 'No non-empty title was recorded in this source.', attention: 'observation', locator: 'head title' }))
    }
    if ((evidence.collectorVersion ?? 1) >= 2 && otherHtml) continue
    observations.push(otherHtml ? observation(evidence, { checkId: 'search-original-title', rule: 'title', source: otherSource, document: other,
      disposition: 'observed', reason: 'separate_source_title', observed: otherHtml('head title').first().text().trim() || 'No title in this source.', locator: 'head title' })
      : unknown(evidence, 'search-original-title', 'presentation', 'title', otherSource))
  }
  return observations
}

function indexing({ evidence, previous }: EvaluatorInput): SearchObservation[] {
  const observations: SearchObservation[] = [], tokens: string[] = []
  let complete = true
  for (const [document, source] of [[evidence.original, 'original-html'], [evidence.rendered, 'rendered-dom']] as const) {
    const $ = html(document, 'indexing')
    if (!$) { complete = false; observations.push(unknown(evidence, 'search-indexing-source', 'indexing', 'indexing', source)); continue }
    const directives: string[] = []
    $('meta[name]').each((_, node) => {
      const name = ($(node).attr('name') ?? '').toLowerCase()
      if (name === 'robots' || name === 'googlebot') directives.push(`${name}: ${$(node).attr('content') ?? ''}`)
    })
    const header = document.headers['x-robots-tag']
    if (header) directives.push(`X-Robots-Tag: ${header}`)
    for (const raw of directives) {
      const parts = raw.toLowerCase().replace(/^x-robots-tag:\s*/, '').split(',')
      let applies = true
      for (let part of parts) {
        const scoped = part.match(/^\s*([\w-]+)\s*:\s*(.*)$/)
        if (scoped && !['max-snippet', 'max-image-preview', 'max-video-preview', 'unavailable_after'].includes(scoped[1])) {
          applies = scoped[1] === 'googlebot' || scoped[1] === 'robots'; part = scoped[2]
        }
        if (applies) tokens.push(...part.split(/[\s;]+/).filter(Boolean))
      }
    }
    observations.push(observation(evidence, { checkId: 'search-indexing-source', rule: 'indexing', responsibility: 'indexing', source, document,
      disposition: 'observed', reason: 'indexing_directives_recorded', observed: directives.join('; ') || 'No applicable indexing exclusions recorded in this source.',
      locator: 'meta[name="robots"], meta[name="googlebot"], X-Robots-Tag' }))
  }
  const excluded = tokens.includes('noindex') || tokens.includes('none')
  const wasAllowed = previous?.pageUrl === evidence.pageUrl && previous.observations.some(item =>
    item.checkId === 'robots-blocks-indexing' && (item.disposition === 'passed' && item.reason === 'no_index_restrictions' ||
      item.attention.kind === 'flag' && item.reason === 'indexing_policy_regressed'))
  const listed = evidence.sitemapsComplete && evidence.sitemapUrls.some(url => urlIdentity(url) === urlIdentity(evidence.pageUrl))
  observations.push(observation(evidence, { checkId: 'robots-blocks-indexing', rule: 'indexing', responsibility: 'indexing', source: 'http',
    disposition: excluded ? wasAllowed || listed ? 'failed' : 'observed' : complete ? 'passed' : 'unknown',
    reason: excluded ? wasAllowed ? 'indexing_policy_regressed' : listed ? 'sitemap_indexing_conflict' : 'declared_indexing_exclusion'
      : complete ? 'no_index_restrictions' : 'indexing_evidence_incomplete',
    observed: excluded ? `Published directives exclude this page from indexing.${listed ? ' The page is also listed in the parsed sitemap.' : ''}`
      : complete ? 'No noindex or none directive was recorded in either public source.' : C.unknown,
    attention: excluded && (wasAllowed || listed) ? 'flag' : 'observation',
    evidence: observations.flatMap(item => item.evidence).slice(0, 20) }))
  return observations
}

function crawl({ evidence, previous }: EvaluatorInput): SearchObservation[] {
  const document = evidence.robots
  if (!document.complete || document.status == null || document.status >= 500 || document.status === 429)
    return [unknown(evidence, 'search-crawl-access', 'crawl', 'robots', 'robots-txt')]
  if (document.status >= 400) return [
    observation(evidence, { checkId: 'robots-txt-missing', rule: 'robots', responsibility: 'crawl', source: 'robots-txt', document,
      disposition: 'observed', reason: 'robots_unavailable_no_restrictions_assumed', observed: `robots.txt returned HTTP ${document.status}. This is not itself an indexing failure.` }),
    observation(evidence, { checkId: 'search-crawl-access', rule: 'robots', responsibility: 'crawl', source: 'robots-txt', document,
      disposition: 'passed', reason: 'crawl_allowed', observed: 'The robots.txt response establishes no applicable crawl restriction under Google’s 4xx interpretation.' }),
  ]
  if (/<(?:!doctype|html)\b/i.test(document.body ?? '')) return [unknown(evidence, 'search-crawl-access', 'crawl', 'robots', 'robots-txt')]
  const parser = robotsParser(document.finalUrl, document.body ?? '')
  const allowed = parser.isAllowed(evidence.pageUrl, 'Googlebot')
  const regression = previous?.pageUrl === evidence.pageUrl && previous.observations.some(item => item.checkId === 'search-crawl-access' &&
    (item.reason === 'crawl_allowed' || item.attention.kind === 'flag' && item.reason === 'crawl_policy_regressed'))
  return [observation(evidence, { checkId: 'search-crawl-access', rule: 'robots', responsibility: 'crawl', source: 'robots-txt', document,
    disposition: allowed === undefined ? 'unknown' : allowed ? 'passed' : regression ? 'failed' : 'observed',
    reason: allowed === undefined ? 'robots_rule_unknown' : allowed ? 'crawl_allowed' : regression ? 'crawl_policy_regressed' : 'declared_crawl_restriction',
    observed: allowed ? 'Applicable robots.txt rules permit Googlebot crawling of this URL.'
      : allowed === false ? `Applicable robots.txt rules restrict crawling of this URL (line ${parser.getMatchingLineNumber(evidence.pageUrl, 'Googlebot') ?? 'unknown'}).`
      : C.unknown, attention: allowed === false && regression ? 'flag' : 'observation', locator: 'Googlebot rules',
    limitation: 'This evaluates published robots.txt rules. It does not prove that a verified Googlebot request can access the server.' })]
}

function crawlWithResponse(input: EvaluatorInput): SearchObservation[] {
  const { evidence } = input, document = evidence.original
  const response = observation(evidence, { checkId: 'search-http-access', rule: 'robots', responsibility: 'crawl', source: 'http', document,
    disposition: document.status == null ? 'unknown' : 'observed', reason: 'public_navigation_response',
    observed: document.status == null ? C.unknown : `HTTP ${document.status}; final URL ${document.finalUrl}. Redirects: ${document.redirects.join(' → ') || 'none recorded'}.`,
    locator: 'original navigation response', limitation: 'This is the public browser response, not proof of access by a verified Googlebot.' })
  return [response, ...crawl(input)]
}

function canonical({ evidence }: EvaluatorInput): SearchObservation[] {
  const declarations: Array<{ url: string; raw: string; document: PublicDocument; source: 'original-html' | 'rendered-dom' | 'http' }> = []
  const observations: SearchObservation[] = []
  let complete = true
  for (const [document, source] of [[evidence.original, 'original-html'], [evidence.rendered, 'rendered-dom']] as const) {
    const $ = html(document, 'canonical')
    if (!$) { complete = false; continue }
    for (const { raw, url } of canonicalDeclarations($, document.finalUrl, source === 'original-html' ? document.headers.link : undefined)) {
      if (url) declarations.push({ url, raw, document, source })
      else observations.push(observation(evidence, { checkId: 'search-canonical-invalid', rule: 'canonical', responsibility: 'canonical', source, document,
        id: `search-canonical-invalid:${source}:${observations.length}`, disposition: 'failed', reason: 'canonical_declaration_invalid',
        observed: raw || 'Empty canonical declaration.', attention: 'flag', locator: 'link[rel="canonical"], Link header' }))
    }
  }
  const urls = [...new Set(declarations.map(item => item.url))]
  observations.push(observation(evidence, { id: 'search-canonical-syntax:http', checkId: 'search-canonical-invalid', rule: 'canonical',
    responsibility: 'canonical', source: 'http', disposition: !complete ? 'unknown' : observations.some(item => item.reason === 'canonical_declaration_invalid') ? 'failed' : 'passed',
    reason: !complete ? 'canonical_evidence_incomplete' : observations.some(item => item.reason === 'canonical_declaration_invalid') ? 'canonical_declaration_invalid' : 'canonical_declarations_parsed',
    observed: `${declarations.length} valid canonical declarations were recorded.`,
    attention: complete && observations.some(item => item.reason === 'canonical_declaration_invalid') ? 'flag' : 'observation' }))
  if (urls.length > 1) observations.push(observation(evidence, { checkId: 'search-canonical-conflict', rule: 'canonical', responsibility: 'canonical', source: 'http',
    disposition: 'failed', reason: 'canonical_signals_conflict', observed: urls.join(' | '), attention: 'flag',
    evidence: declarations.slice(0, 20).map(item => ({ source: item.source, url: item.document.finalUrl,
      locator: 'canonical declaration', excerpt: item.raw, collectedAt: item.document.collectedAt })) }))
  else observations.push(observation(evidence, { checkId: 'search-canonical-conflict', rule: 'canonical', responsibility: 'canonical',
    source: 'http', disposition: complete ? 'passed' : 'unknown',
    reason: complete ? 'canonical_signals_consistent' : 'canonical_evidence_incomplete',
    observed: complete ? `${urls.length} distinct canonical targets were recorded; no contradictory declarations were found in the inspected sources.` : C.unknown }))
  for (const url of urls) {
    const target = evidence.canonicalTargets.find(item => item.url === url || item.finalUrl === url)
    const broken = target?.complete && target.status != null && target.status >= 400 && target.status < 500 && target.status !== 429
    observations.push(observation(evidence, { checkId: 'search-canonical-target', rule: 'canonical', responsibility: 'canonical', source: 'http',
      id: `search-canonical-target:${url}`, disposition: broken ? 'failed' : target?.complete && target.status != null && target.status >= 200 && target.status < 300 ? 'passed' : 'unknown',
      reason: broken ? 'canonical_target_broken' : target?.complete && target.status === 200 ? 'canonical_target_reachable' : 'canonical_target_unverified',
      observed: `${url}: ${target?.status == null ? 'response unavailable' : `HTTP ${target.status}`}`, attention: broken ? 'flag' : 'observation', document: target,
      locator: 'canonical target response' }))
  }
  if (!urls.length && !observations.some(item => item.reason === 'canonical_declaration_invalid')) observations.push(complete
    ? observation(evidence, { checkId: 'canonical-missing', rule: 'canonical', responsibility: 'canonical', source: 'http', disposition: 'observed',
      reason: 'canonical_optional_absent', observed: 'No canonical preference was recorded. This does not itself prevent indexing.' })
    : unknown(evidence, 'canonical-missing', 'canonical', 'canonical', 'http'))
  return observations.map(item => ({ ...item, checkVersion: 3 as const, attention: { ...item.attention, version: 3 as const } }))
}

function discovery({ evidence }: EvaluatorInput): SearchObservation[] {
  if (!evidence.sitemaps.length) return [unknown(evidence, 'sitemap-missing', 'discovery', 'sitemap', 'sitemap')]
  return evidence.sitemaps.flatMap((document, index) => {
    const parsed = parseSitemap(document), missing = document.status === 404 || document.status === 410
    const declared = evidence.declaredSitemaps.includes(document.url)
    const invalid = document.complete && document.status === 200 && !parsed.valid && !['sitemap_url_limit'].includes(parsed.reason)
    const base = { rule: 'sitemap' as const, responsibility: 'discovery' as const, source: 'sitemap' as const,
      document, locator: 'sitemap document', observed: parsed.valid ? `${parsed.urls.length} page URLs and ${parsed.children.length} child sitemaps recorded in this document.`
        : missing ? `${document.url} returned HTTP ${document.status}.` : parsed.reason }
    return [
      ...(parsed.valid ? [observation(evidence, { ...base, checkId: 'search-sitemap-contents', id: `sitemap-contents:${index}`,
        disposition: 'observed', reason: 'sitemap_parsed' })] : []),
      observation(evidence, { ...base, checkId: 'sitemap-missing', id: `sitemap-presence:${index}`,
        disposition: parsed.valid || invalid ? 'passed' : missing && declared ? 'failed' : missing ? 'observed' : 'unknown',
        reason: parsed.valid || invalid ? 'sitemap_response_recorded' : parsed.reason,
        attention: missing && declared ? 'flag' : missing ? 'recommendation' : 'observation' }),
      observation(evidence, { ...base, checkId: 'search-sitemap-invalid', id: `sitemap-syntax:${index}`,
        disposition: parsed.valid ? 'passed' : invalid ? 'failed' : missing ? 'not_applicable' : 'unknown',
        reason: parsed.reason, attention: invalid ? declared ? 'flag' : 'recommendation' : 'observation' }),
    ]
  }).concat(evidence.sitemapsComplete ? [] : [unknown(evidence, 'search-sitemap-coverage', 'discovery', 'sitemap', 'sitemap')])
}

function discoveryWithLinks(input: EvaluatorInput): SearchObservation[] {
  const { evidence } = input, [document, source] = primary(evidence, 'links'), $ = html(document, 'links')
  if (!$) return [...discovery(input), unknown(evidence, 'search-discovery-links', 'discovery', 'sitemap', source)]
  const links: string[] = []
  $('a[href]').each((_, node) => {
    try {
      const url = new URL($(node).attr('href')!, document.finalUrl)
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) links.push(url.toString())
    } catch { /* Invalid links do not become discovery evidence. */ }
  })
  const urls = [...new Set(links)]
  const listed = evidence.sitemapUrls.some(url => urlIdentity(url) === urlIdentity(evidence.pageUrl))
  return [...discovery(input), observation(evidence, { checkId: 'search-discovery-links', rule: 'sitemap', responsibility: 'discovery', source, document,
    disposition: 'observed', reason: 'checked_page_discovery_recorded',
    observed: `${urls.length} distinct HTTP links were recorded on this checked page. ${listed ? 'This page appears in the parsed sitemap scope.' : evidence.sitemapsComplete ? 'This page was not recorded in the inspected sitemap scope.' : 'Sitemap coverage is incomplete.'}`,
    locator: 'a[href] and inspected sitemap locations', excerpt: urls.slice(0, 20).join('\n'),
    limitation: 'Links support discovery; their presence does not establish indexing or destination health. Only this page and the inspected sitemap scope were checked.' })]
}

async function structured({ evidence }: EvaluatorInput): Promise<SearchObservation[]> {
  const observations: SearchObservation[] = []
  const [document, source] = primary(evidence, 'structured')
  const $ = html(document, 'structured')
  const contextBody = document.searchSnapshot && ['metadata', 'text', 'links'].every(key => document.searchSnapshot!.sections[key as SearchSection].complete)
    ? `<html><head>${document.searchSnapshot.sections.metadata.html}</head><body>${document.searchSnapshot.sections.text.html}${document.searchSnapshot.sections.links.html}</body></html>` : null
  const context = contextBody ? cheerio.load(contextBody) : document.searchSnapshot ? null : $
  if (!$) return [unknown(evidence, 'no-structured-data', 'structured-data', 'markup', source)]
  // Content matching enriches markup inspection. Missing or bounded page prose
  // cannot discard independently collected syntax and entity observations.
  const visible = context?.root().clone()
  visible?.find('script, style, template, noscript, [hidden], [aria-hidden="true"]').remove()
  const visibleText = visible?.text()
  for (const [snapshot, snapshotSource] of [[evidence.original, 'original-html'], [evidence.rendered, 'rendered-dom']] as const) {
    if (!html(snapshot, 'structured')) { observations.push(unknown(evidence, 'search-structured-invalid', 'structured-data', 'markup', snapshotSource)); continue }
    const inspection = await inspectStructuredData(snapshot)
    const syntaxFailed = inspection.issues.some(issue => ['invalid_json', 'invalid_jsonld'].includes(issue.reason))
    observations.push(observation(evidence, { checkId: 'search-structured-source', rule: 'markup', responsibility: 'structured-data',
      source: snapshotSource, document: snapshot, disposition: inspection.complete ? 'observed' : 'unknown',
      reason: 'structured_entities_recorded', observed: inspection.entities.length
        ? inspection.entities.slice(0, 20).map(entity => `${entity.format}: ${entity.types.join(', ') || 'untyped entity'}`).join('; ')
        : 'No entities were established from this source.', limitation: C.structuredLimit }))
    observations.push(observation(evidence, { checkId: 'search-structured-invalid', rule: 'markup', responsibility: 'structured-data',
      source: snapshotSource, document: snapshot, disposition: syntaxFailed ? 'failed' : !inspection.complete ? 'unknown'
        : inspection.blocks || inspection.entities.length ? 'passed' : 'not_applicable',
      reason: syntaxFailed ? 'markup_syntax_invalid' : !inspection.complete ? 'markup_syntax_incomplete'
        : inspection.blocks || inspection.entities.length ? 'markup_syntax_parsed' : 'no_published_markup',
      observed: `${inspection.blocks} JSON-LD blocks and ${inspection.entities.length} structured entities inspected.`,
      attention: syntaxFailed ? 'flag' : 'observation', limitation: C.structuredLimit }))
    for (const [index, issue] of inspection.issues.entries()) observations.push(observation(evidence, {
      id: `markup:${snapshotSource}:${index}`, checkId: 'search-structured-invalid', rule: 'markup', responsibility: 'structured-data', source: snapshotSource,
      document: snapshot, disposition: ['invalid_json', 'invalid_jsonld'].includes(issue.reason) ? 'failed' : 'unknown', reason: issue.reason,
      observed: `${issue.locator}: ${issue.reason}`, locator: issue.locator, excerpt: issue.excerpt,
      attention: ['invalid_json', 'invalid_jsonld'].includes(issue.reason) ? 'flag' : 'observation', limitation: C.structuredLimit }))
    for (const entity of inspection.entities.filter(entity => entity.types.length)) {
      for (const type of entity.types) {
        const profile = type === 'BlogPosting' || type === 'NewsArticle' || type === 'TechArticle' ? 'Article' : type
        const feature = inspectFeature(entity, profile, inspection.entities)
        const details = feature ? [...feature.invalid.map(key => `Invalid: ${key}`), ...feature.missing.map(key => `Missing feature requirement: ${key}`),
          ...feature.recommended.map(key => `Recommended: ${key}`)] : ['Detected type is outside feature-specific validation.']
        observations.push(observation(evidence, { id: `entity:${snapshotSource}:${entity.id}:${type}`,
          checkId: 'search-structured-feature', rule: 'feature', name: `${entity.format} · ${type}`, responsibility: 'structured-data',
          source: snapshotSource, document: snapshot, disposition: feature ? feature.invalid.length ? 'failed' : feature.missing.length || feature.recommended.length ? 'observed' : 'passed' : 'not_applicable',
          reason: feature ? feature.invalid.length ? 'markup_property_invalid' : feature.missing.length ? 'feature_requirements_missing' : feature.recommended.length ? 'feature_recommended_properties' : 'supported_feature_rules_passed' : 'unsupported_feature_type',
          observed: details.length ? details.join('; ') : 'The stated feature rules passed for this entity.',
          attention: feature?.invalid.length ? 'flag' : feature && (feature.missing.length || feature.recommended.length) ? 'recommendation' : 'observation',
          locator: entity.locator, entityTypes: [type], entityId: entity.id,
          invalidProperties: feature?.invalid ?? [], limitation: C.structuredLimit,
          guidance: feature ? `${C.rules.feature.guidance} Reference: ${feature.source}` : C.rules.feature.guidance }))
        const name = entityValues(entity, profile === 'Article' ? 'headline' : 'name', inspection.entities)[0]
        if (visibleText !== undefined && snapshotSource === source && typeof name === 'string' && name.length > 3 && !visibleText.includes(name)) {
          observations.push(observation(evidence, { id: `content:${entity.id}:${type}`, checkId: 'search-structured-content', rule: 'feature', responsibility: 'structured-data',
            source, document, disposition: 'observed', reason: 'content_correspondence_unconfirmed',
            observed: `The declared name was not located in the extracted page text: ${name.slice(0, 200)}`, attention: 'recommendation',
            locator: entity.locator, limitation: 'Text matching is bounded guidance, not proof that the markup is misleading.' }))
        }
      }
    }
    if (!context && snapshotSource === source && inspection.entities.some(entity => entity.types.length))
      observations.push(observation(evidence, { checkId: 'search-structured-content', rule: 'feature', responsibility: 'structured-data', source, document,
        disposition: 'unknown', reason: 'content_context_incomplete',
        observed: 'Structured markup was inspected, but complete page context was unavailable for content matching.',
        limitation: 'Independent markup syntax and feature-property results remain available. Text correspondence was not established.' }))
    if (context && inspection.complete && snapshotSource === source) {
      const suggested: string[] = []
      if (new URL(evidence.pageUrl).pathname === '/' && context('title').text().trim()) suggested.push('WebSite')
      if (context('article').length && context('article h1, article h2').text().trim()) suggested.push('Article')
      if (context('[aria-label*="breadcrumb" i]').find('a').length >= 2) suggested.push('BreadcrumbList')
      if (context('meta[property="og:type"][content="product"]').length && /add to cart|buy now/i.test(context('button').text())) suggested.push('Product')
      const brand = context('meta[property="og:site_name"]').attr('content')?.trim()
      if (new URL(evidence.pageUrl).pathname === '/' && brand && visible?.find('footer').text().includes(brand)) suggested.push('Organization')
      if (context('meta[name="apple-itunes-app"]').length || context('a[href*="apps.apple.com/"], a[href*="play.google.com/store/apps/"]').length) suggested.push('SoftwareApplication')
      const types = new Set(inspection.entities.flatMap(entity => entity.types.map(type => ['BlogPosting', 'NewsArticle', 'TechArticle'].includes(type) ? 'Article' : type)))
      const missing = suggested.filter(type => !types.has(type))
      if (missing.length) observations.push(observation(evidence, { checkId: 'no-structured-data', rule: 'opportunity', responsibility: 'structured-data', source, document,
        disposition: 'observed', reason: 'relevant_markup_opportunity', observed: `The public page supports reviewing ${missing.join(', ')} markup; these types were not recorded.`,
        attention: 'recommendation', entityTypes: missing, limitation: C.structuredLimit }))
      else if (!inspection.entities.length) observations.push(observation(evidence, { checkId: 'no-structured-data', rule: 'markup', responsibility: 'structured-data', source, document,
        disposition: 'observed', reason: 'no_applicable_markup_opportunity_established', observed: 'No structured entities were recorded; a relevant type was not established.', limitation: C.structuredLimit }))
    }
    if (!inspection.complete) observations.push(unknown(evidence, 'search-structured-coverage', 'structured-data', 'markup', snapshotSource))
  }
  return observations
}

export const SEARCH_CHECK_DEFINITIONS: readonly Definition[] = [
  ...SEARCH_DEFINITIONS.filter(definition => !['google', 'cross-page'].includes(definition.evaluator)).map(definition => ({
    ...definition, id: `search.${definition.evaluator}`, version: 2 as const, resultSchema: 'search-observation-v2' as const,
    evaluate: ({ presentation, indexing, crawl: crawlWithResponse, canonical, discovery: discoveryWithLinks, 'structured-data': structured } as Record<string, Definition['evaluate']>)[definition.evaluator],
  })),
]

export function validateSearchRegistration(definitions: readonly Definition[]) {
  const ids = new Set<string>()
  for (const definition of definitions) {
    if (ids.has(definition.id) || typeof definition.evaluate !== 'function' || definition.version !== 2 || !definition.assertions.length ||
      definition.resultSchema !== 'search-observation-v2' || !definition.checkIds.length)
      throw new Error(`Invalid Search registration: ${definition.id}`)
    ids.add(definition.id)
    for (const id of definition.checkIds) {
      if (ids.has(id)) throw new Error(`Duplicate Search identity: ${id}`)
      ids.add(id)
    }
  }
}
validateSearchRegistration(SEARCH_CHECK_DEFINITIONS)

export async function evaluateSearch(evidence: SearchPageEvidence, previous?: SearchReceipt | null, evaluators?: readonly string[]) {
  const observations: SearchObservation[] = []
  for (const definition of SEARCH_CHECK_DEFINITIONS) {
    if (evaluators && !evaluators.includes(definition.id.slice(7))) continue
    if (!evidence.public) {
      observations.push(unknown(evidence, definition.checkIds[0], definition.responsibility, definition.guidance, 'http')); continue
    }
    try {
      const results = await definition.evaluate({ evidence, previous })
      if (results.some(item => !definition.checkIds.includes(item.checkId) || !Object.hasOwn(SEARCH_CHECK_REGISTRY, item.checkId)))
        throw new Error('Unregistered Search observation')
      observations.push(...results.map(item => searchObservationSchema.parse(item)))
    } catch { observations.push(unknown(evidence, definition.checkIds[0], definition.responsibility, definition.guidance, 'http')) }
  }
  return observations
}

export function evaluateCheckedPageTitles(receipts: SearchReceipt[]): Map<string, SearchObservation[]> {
  const byPage = new Map(receipts.map(receipt => [receipt.pageUrl, receipt]))
  const titles = [...byPage.values()].flatMap(receipt => {
    const title = receipt.observations.find(item => item.checkId === 'title-missing' && item.disposition === 'passed')
    return title ? [{ receipt, title, identity: title.observed.trim().replace(/\s+/g, ' ').toLowerCase() }] : []
  })
  const results = new Map<string, SearchObservation[]>()
  for (const { receipt, title, identity } of titles) {
    const peers = titles.filter(other => other.identity === identity)
    const duplicates = peers.length > 1
    const item = searchObservationSchema.parse({
      ...title, id: 'search-duplicate-title:checked-pages', checkId: 'search-duplicate-title',
      name: C.rules.duplicates.name, expected: C.rules.duplicates.expected, guidance: C.rules.duplicates.guidance,
      disposition: titles.length < 2 ? 'not_applicable' : duplicates ? 'observed' : 'passed',
      reason: titles.length < 2 ? 'peer_page_coverage_unavailable' : duplicates ? 'duplicate_checked_page_titles' : 'checked_page_titles_distinct',
      observed: titles.length < 2 ? 'Only one checked public page supplied a non-empty title.'
        : duplicates ? `${peers.length} checked pages use this title: ${title.observed}`
        : `This title differs from the other ${titles.length - 1} checked page titles.`,
      attention: { policy: 'search', version: title.checkVersion, kind: duplicates ? 'recommendation' : 'observation',
        reason: duplicates ? 'duplicate_checked_page_titles' : 'checked_page_title_comparison' },
      evidence: peers.slice(0, 20).flatMap(other => other.title.evidence),
      limitation: 'Comparison is limited to non-empty titles recorded on these checked pages. It does not establish site-wide uniqueness.',
    })
    results.set(receipt.pageUrl, [item])
  }
  return results
}

export function searchFindings(observations: SearchObservation[]): DeterministicFlag[] {
  const findings = new Map<string, DeterministicFlag>()
  for (const item of observations) {
    if (item.attention.kind === 'observation') continue
    const prior = findings.get(item.checkId)
    if (prior && (prior.attentionPolicy?.kind === 'flag' || item.attention.kind !== 'flag')) continue
    findings.set(item.checkId, { checkId: item.checkId, rubric: 'REACH', source: 'DETERMINISTIC', impactTag: 'SEO',
      severity: item.attention.kind === 'flag' ? item.checkId === 'title-missing' ? 'CRITICAL' : 'IMPORTANT' : 'POLISH',
      confidence: item.attention.kind === 'flag' ? 1 : 0.8,
      problem: C.problems[item.reason as keyof typeof C.problems] ?? item.name, evidence: item.observed,
      fix: item.guidance, pageUrl: item.pageUrl,
      verificationRule: `A fresh independent public execution establishes: ${item.expected} Scope: ${item.pageUrl}. Missing or unsupported evidence cannot establish recovery.`,
      attentionPolicy: { ...item.attention, google: item.google,
        sources: [...new Set(observations.filter(other => other.checkId === item.checkId &&
          other.attention.kind === item.attention.kind).map(other => other.source))],
        markupTargets: observations.filter(other => other.checkId === item.checkId && other.attention.kind === 'flag' &&
          other.entityId && other.invalidProperties?.length).flatMap(other => (other.entityTypes ?? []).map(entityType => ({
            entityId: other.entityId!, entityType, source: other.source, properties: other.invalidProperties!,
          }))),
        entityTypes: [...new Set(observations.filter(other =>
        other.checkId === item.checkId && other.attention.kind === 'flag').flatMap(other => other.entityTypes ?? []))] } })
  }
  return [...findings.values()].map(flag => ({ ...flag, attentionPolicy: pageScopedSearchAttention(flag.attentionPolicy!, flag.pageUrl!) }))
}
