import { searchSectionBody } from './rendered-snapshot'
import * as cheerio from 'cheerio'
import jsonld, { type JsonLdDocument } from 'jsonld'
import { MicrodataRdfParser } from 'microdata-rdf-streaming-parser'
import { RdfaParser } from 'rdfa-streaming-parser'
import type { Quad } from '@rdfjs/types'
import type { Transform } from 'node:stream'
import context from './schemaorg-context.json'
import type { PublicDocument } from './contracts'

export const STRUCTURED_BLOCK_LIMIT = 50
export const STRUCTURED_ENTITY_LIMIT = 200
export const STRUCTURED_QUAD_LIMIT = 10_000
export type StructuredEntity = {
  id: string; types: string[]; properties: Record<string, unknown[]>; locator: string;
  format: 'JSON-LD' | 'Microdata' | 'RDFa';
}
export type MarkupIssue = { locator: string; reason: 'invalid_json' | 'invalid_jsonld' | 'unsupported_context' | 'parser_limit' | 'parser_failed'; excerpt: string }
export type StructuredInspection = { entities: StructuredEntity[]; issues: MarkupIssue[]; blocks: number; complete: boolean }

const CONTEXT_URLS = new Set(['http://schema.org', 'https://schema.org', 'http://schema.org/', 'https://schema.org/',
  'http://schema.org/docs/jsonldcontext.jsonld', 'https://schema.org/docs/jsonldcontext.jsonld'])

/** Vendored Schema.org context, retrieved 2026-10-11. No page-controlled network requests. */
export async function schemaDocumentLoader(url: string) {
  if (!CONTEXT_URLS.has(url)) throw new Error('unsupported_context')
  return { documentUrl: url, document: context }
}

export function schemaTerm(value: string): string {
  return value.replace(/^https?:\/\/schema\.org\//, '')
}

function boundedJson(value: unknown, depth = 0, count = { value: 0 }): boolean {
  if (depth > 40 || ++count.value > 10_000) return false
  if (Array.isArray(value)) return value.every(item => boundedJson(item, depth + 1, count))
  if (value && typeof value === 'object') return Object.values(value).every(item => boundedJson(item, depth + 1, count))
  return true
}

function unsupportedContext(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(unsupportedContext)
  if (!value || typeof value !== 'object') return false
  for (const [key, item] of Object.entries(value)) {
    if ((key === '@context' || key === '@import') &&
      (typeof item === 'string' ? !CONTEXT_URLS.has(item) : Array.isArray(item) && item.some(context => typeof context === 'string' && !CONTEXT_URLS.has(context)))) return true
    if (unsupportedContext(item)) return true
  }
  return false
}

function normalizedEntities(value: unknown, format: StructuredEntity['format'], locator: string): StructuredEntity[] {
  const rows = Array.isArray(value) ? value : value && typeof value === 'object' && '@graph' in value
    ? (value as { '@graph': unknown })['@graph'] : []
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row, index) => {
    if (!row || typeof row !== 'object') return []
    const node = row as Record<string, unknown>
    const types = Array.isArray(node['@type']) ? node['@type'].filter((type): type is string => typeof type === 'string').map(schemaTerm) : []
    const id = typeof node['@id'] === 'string' ? node['@id'] : `_:entity${index}`
    return [{ id: id.startsWith('_:') ? `${locator}:${id}` : id, types,
      properties: Object.fromEntries(Object.entries(node).filter(([key]) => !key.startsWith('@')).map(([key, raw]) =>
        [schemaTerm(key), (Array.isArray(raw) ? raw : [raw]).map(item => {
          if (item && typeof item === 'object' && '@id' in item) {
            const reference = item as { '@id': unknown }
            return typeof reference['@id'] === 'string' && reference['@id'].startsWith('_:')
              ? { ...item, '@id': `${locator}:${reference['@id']}` } : item
          }
          return item
        })])), locator, format } satisfies StructuredEntity]
  })
}

async function parseEmbeddedGraph(html: string, baseIRI: string, format: 'Microdata' | 'RDFa'): Promise<unknown> {
  const parser = (format === 'Microdata' ? new MicrodataRdfParser({ baseIRI }) : new RdfaParser({ baseIRI })) as unknown as Transform
  const quads = await new Promise<Quad[]>((resolve, reject) => {
    const values: Quad[] = []
    parser.on('error', reject)
    parser.on('data', (quad: Quad) => {
      if (values.length >= STRUCTURED_QUAD_LIMIT) parser.destroy(new Error('parser_limit'))
      else values.push(quad)
    })
    parser.on('end', () => resolve(values))
    parser.end(html)
  })
  return jsonld.fromRDF(quads)
}

export async function inspectStructuredData(document: PublicDocument): Promise<StructuredInspection> {
  const body = searchSectionBody(document, 'structured')
  if (body == null) return { entities: [], issues: [], blocks: 0, complete: false }
  const $ = cheerio.load(body), entities: StructuredEntity[] = [], issues: MarkupIssue[] = []
  const blocks: Array<{ locator: string; text: string }> = []
  $('script').each((index, node) => {
    if (($(node).attr('type') ?? '').trim().toLowerCase() === 'application/ld+json')
      blocks.push({ locator: `script[type="application/ld+json"]:${index}`, text: $(node).html() ?? '' })
  })
  for (const block of blocks.slice(0, STRUCTURED_BLOCK_LIMIT)) {
    let parsed: unknown
    try { parsed = JSON.parse(block.text) }
    catch { issues.push({ locator: block.locator, reason: 'invalid_json', excerpt: block.text.slice(0, 2000) }); continue }
    if (!boundedJson(parsed)) { issues.push({ locator: block.locator, reason: 'parser_limit', excerpt: '' }); continue }
    if (unsupportedContext(parsed)) { issues.push({ locator: block.locator, reason: 'unsupported_context', excerpt: block.text.slice(0, 2000) }); continue }
    try {
      const flat = await jsonld.flatten(parsed as JsonLdDocument, undefined, { base: document.finalUrl, documentLoader: schemaDocumentLoader })
      entities.push(...normalizedEntities(flat, 'JSON-LD', block.locator))
    } catch (error) {
      const contextFailure = error instanceof Error && (error.message.includes('unsupported_context') ||
        ('details' in error && JSON.stringify(error.details).includes('unsupported_context')))
      issues.push({ locator: block.locator, reason: contextFailure ? 'unsupported_context' : 'invalid_jsonld', excerpt: block.text.slice(0, 2000) })
    }
  }
  if (blocks.length > STRUCTURED_BLOCK_LIMIT) issues.push({ locator: 'script[type="application/ld+json"]', reason: 'parser_limit', excerpt: '' })
  for (const format of ['Microdata', 'RDFa'] as const) {
    const selector = format === 'Microdata' ? '[itemscope][itemtype]' : '[typeof], [vocab], [prefix][property]'
    if (!$(selector).length) continue
    try { entities.push(...normalizedEntities(await parseEmbeddedGraph(body, document.finalUrl, format), format, selector)) }
    catch (error) { issues.push({ locator: selector, reason: error instanceof Error && error.message.includes('parser_limit') ? 'parser_limit' : 'parser_failed', excerpt: '' }) }
  }
  if (entities.length > STRUCTURED_ENTITY_LIMIT) issues.push({ locator: 'structured-data', reason: 'parser_limit', excerpt: '' })
  const byId = new Map<string, StructuredEntity>()
  for (const entity of entities.slice(0, STRUCTURED_ENTITY_LIMIT)) {
    const prior = byId.get(entity.id)
    if (!prior) byId.set(entity.id, entity)
    else { prior.types = [...new Set([...prior.types, ...entity.types])]
      for (const [key, values] of Object.entries(entity.properties)) prior.properties[key] = [...(prior.properties[key] ?? []), ...values] }
  }
  return { entities: [...byId.values()], issues, blocks: blocks.length,
    complete: !issues.some(issue => ['unsupported_context', 'parser_limit', 'parser_failed'].includes(issue.reason)) }
}

export function entityValues(entity: StructuredEntity, property: string, entities: StructuredEntity[]): unknown[] {
  return (entity.properties[property] ?? []).map(value => {
    if (!value || typeof value !== 'object') return value
    const node = value as Record<string, unknown>
    if ('@value' in node) return node['@value']
    if (typeof node['@id'] === 'string') return entities.find(item => item.id === node['@id']) ?? node['@id']
    return node
  })
}

export type FeatureRules = { required: string[]; recommended: string[]; oneOf?: string[]; source: string }
/** Google feature requirements are distinct from general Schema.org validity. */
export const STRUCTURED_FEATURE_RULES: Record<string, FeatureRules> = {
  Organization: { required: [], recommended: ['name', 'url'], source: 'https://developers.google.com/search/docs/appearance/structured-data/organization' },
  WebSite: { required: ['name', 'url'], recommended: [], source: 'https://developers.google.com/search/docs/appearance/site-names' },
  BreadcrumbList: { required: ['itemListElement'], recommended: [], source: 'https://developers.google.com/search/docs/appearance/structured-data/breadcrumb' },
  Product: { required: ['name'], recommended: [], oneOf: ['offers', 'review', 'aggregateRating'], source: 'https://developers.google.com/search/docs/appearance/structured-data/product-snippet' },
  Article: { required: [], recommended: ['headline', 'author', 'datePublished', 'image'], source: 'https://developers.google.com/search/docs/appearance/structured-data/article' },
  SoftwareApplication: { required: ['name', 'offers'], recommended: [], oneOf: ['review', 'aggregateRating'], source: 'https://developers.google.com/search/docs/appearance/structured-data/software-app' },
}

export function inspectFeature(entity: StructuredEntity, type: string, entities: StructuredEntity[]) {
  const rules = STRUCTURED_FEATURE_RULES[type]
  if (!rules) return null
  const has = (key: string) => entityValues(entity, key, entities).some(value => value !== '' && value != null)
  const missing = rules.required.filter(key => !has(key))
  if (rules.oneOf && !rules.oneOf.some(has)) missing.push(rules.oneOf.join(' or '))
  const invalid: string[] = []
  const urls = entityValues(entity, 'url', entities)
  for (const value of urls) {
    try { if (typeof value !== 'string' || !['https:', 'http:'].includes(new URL(value).protocol)) invalid.push('url') }
    catch { invalid.push('url') }
  }
  if (type === 'Product' || type === 'SoftwareApplication') {
    for (const offer of entityValues(entity, 'offers', entities)) {
      if (!offer || typeof offer !== 'object' || !('properties' in offer)) { missing.push('offers.price'); continue }
      const prices = entityValues(offer as StructuredEntity, 'price', entities)
      const lowPrices = entityValues(offer as StructuredEntity, 'lowPrice', entities)
      const supplied = prices.length ? prices : type === 'Product' ? lowPrices : []
      if (!supplied.length) missing.push(type === 'Product' ? 'offers.price or offers.lowPrice' : 'offers.price')
      if (supplied.some(value => !['string', 'number'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) invalid.push('offers.price')
    }
  }
  if (type === 'BreadcrumbList') {
    const items = entityValues(entity, 'itemListElement', entities)
    if (items.length < 2) missing.push('at least two breadcrumb items')
    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      if (!item || typeof item !== 'object' || !('properties' in item)) { invalid.push(`itemListElement[${index}]`); continue }
      const node = item as StructuredEntity
      if (!entityValues(node, 'name', entities).length) missing.push(`itemListElement[${index}].name`)
      const position = entityValues(node, 'position', entities)[0]
      if (position == null) missing.push(`itemListElement[${index}].position`)
      else if (!Number.isInteger(Number(position)) || Number(position) < 1) invalid.push(`itemListElement[${index}].position`)
      if (index < items.length - 1 && !entityValues(node, 'item', entities).length) missing.push(`itemListElement[${index}].item`)
    }
  }
  return { missing: [...new Set(missing)], recommended: rules.recommended.filter(key => !has(key)),
    invalid: [...new Set(invalid)], source: rules.source }
}
