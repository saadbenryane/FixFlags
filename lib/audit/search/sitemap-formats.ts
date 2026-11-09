import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { EntityDecoder } from '@nodable/entities'
import { SITEMAP_URL_LIMIT } from './contracts'

const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'
const ATOM_NAMESPACE = 'http://www.w3.org/2005/Atom'
const ATOM_ALTERNATE = 'http://www.iana.org/assignments/relation/alternate'
type Namespaces = ReadonlyMap<string, string>
type XmlNode = Record<string, XmlNode[] | string | Record<string, string>>
type SitemapCandidate = { url: string | null; reason: string | null }
export type SitemapResult = { urls: string[]; children: string[]; valid: boolean; reason: string; format?: 'text' | 'rss' | 'atom' }

class InvalidSitemapReference extends Error {}

/** Decode XML references once, keeping CDATA literal and refusing DTDs. */
function sitemapEntityDecoder() {
  return new EntityDecoder({
    numericAllowed: true,
    onInputEntity: () => 'throw', onExternalEntity: () => 'throw',
    postCheck: (resolved, original) => {
      if (/&(?!amp;|lt;|gt;|quot;|apos;|#(?:[0-9]+|x[0-9a-fA-F]+);)/.test(original))
        throw new InvalidSitemapReference('Undeclared XML entity')
      for (const match of original.matchAll(/&#(x[0-9a-fA-F]+|[0-9]+);/g)) {
        const code = match[1].startsWith('x') ? parseInt(match[1].slice(1), 16) : Number(match[1])
        if (!(code === 9 || code === 10 || code === 13 || code >= 0x20 && code <= 0xd7ff ||
          code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff))
          throw new InvalidSitemapReference('Invalid XML character reference')
      }
      return resolved
    },
  })
}

export function sitemapLocation(value: string): string | null {
  const location = value.trim()
  if (!/^https?:\/\//i.test(location) || /[\s#\\]/.test(location)) return null
  try {
    const url = new URL(location)
    return !url.username && !url.password ? url.href : null
  } catch { return null }
}

function xmlChildren(nodes: XmlNode[], parentNamespaces: Namespaces) {
  let text = ''
  const elements = []
  for (const node of nodes) {
    const name = Object.keys(node).find(key => key !== ':@')!
    if (name === '#text') { text += node[name]; continue }
    if (name.startsWith('?')) continue
    const children = node[name] as XmlNode[]
    const attributes = node[':@'] as Record<string, string> | undefined
    const declarations = Object.entries(attributes ?? {}).filter(([key]) => key === '@_xmlns' || key.startsWith('@_xmlns:'))
    const namespaces = declarations.length ? new Map([...parentNamespaces, ...declarations.map(([key, uri]) => [key.slice(8), uri] as const)])
      : parentNamespaces
    const [first, second, extra] = name.split(':')
    const local = second ?? first
    const namespace = extra !== undefined || !local || second !== undefined && !first ? undefined
      : second === undefined ? namespaces.get('') ?? '' : namespaces.get(first) || undefined
    elements.push({ local, namespace, namespaces, children, attributes })
  }
  return { elements, text }
}

type XmlElement = ReturnType<typeof xmlChildren>['elements'][number]

function candidate(value: string): SitemapCandidate {
  const url = sitemapLocation(value)
  return { url, reason: url ? null : 'sitemap_invalid_location' }
}

function invalidStructure(): SitemapCandidate {
  return { url: null, reason: 'sitemap_invalid_structure' }
}

function textLocation(element: XmlElement): SitemapCandidate {
  const location = xmlChildren(element.children, element.namespaces)
  return location.elements.length ? invalidStructure() : candidate(location.text)
}

function readLocations<T>(entries: Iterable<T>, read: (entry: T) => SitemapCandidate | null, issue: string | null = null) {
  const urls: string[] = []
  let count = 0
  for (const entry of entries) {
    if (++count > SITEMAP_URL_LIMIT) return { urls, issue: 'sitemap_url_limit' }
    const result = read(entry)
    if (result?.url) urls.push(result.url)
    else issue ??= result?.reason ?? null
  }
  return { urls, issue }
}

function pageList(urls: string[], issue: string | null): SitemapResult {
  return { urls, children: [], valid: issue === null, reason: issue ?? 'sitemap_parsed' }
}

function* textLines(body: string) {
  for (const [line] of body.matchAll(/[^\r\n]+/g)) if (line.trim()) yield line
}

export function parseTextSitemap(body: string): SitemapResult {
  const { urls, issue } = readLocations(textLines(body), candidate)
  return { ...pageList(urls, issue ?? (urls.length ? null : 'sitemap_no_page_locations')), format: 'text' }
}

function sitemapEntry(entry: XmlElement, core: string): SitemapCandidate {
  const { elements, text } = xmlChildren(entry.children, entry.namespaces)
  const fields = elements.filter(field => field.namespace === core)
  const locations = fields.filter(field => field.local === 'loc')
  const metadata = entry.local === 'sitemap' ? ['lastmod'] : ['lastmod', 'changefreq', 'priority']
  if (text.trim() || elements.some(field => field.namespace === undefined || field.namespace === '' && core !== '') ||
    fields.some(field => field.local !== 'loc' && !metadata.includes(field.local)) || locations.length !== 1)
    return invalidStructure()
  return textLocation(locations[0])
}

function rssEntry(entry: XmlElement): SitemapCandidate | null {
  const { elements } = xmlChildren(entry.children, entry.namespaces)
  const links = elements.filter(field => field.namespace === '' && field.local === 'link')
  if (links.length > 1) return invalidStructure()
  if (links.length === 1) return textLocation(links[0])
  const permalinks = elements.filter(field => field.namespace === '' && field.local === 'guid' &&
    (field.attributes?.['@_isPermaLink'] ?? 'true') === 'true')
  if (permalinks.length > 1) return invalidStructure()
  return permalinks[0] ? textLocation(permalinks[0]) : null
}

function* atomAlternateLinks(entries: XmlElement[]) {
  for (const entry of entries) {
    const { elements } = xmlChildren(entry.children, entry.namespaces)
    for (const field of elements) {
      if (field.namespace !== ATOM_NAMESPACE || field.local !== 'link') continue
      const relation = field.attributes?.['@_rel'] ?? 'alternate'
      if (relation === 'alternate' || relation === ATOM_ALTERNATE) yield field
    }
  }
}

function parseFeed(root: XmlElement): SitemapResult | null {
  if (root.local === 'feed' && root.namespace === ATOM_NAMESPACE) {
    const { elements, text } = xmlChildren(root.children, root.namespaces)
    const entries = elements.filter(entry => entry.namespace === ATOM_NAMESPACE && entry.local === 'entry')
    const { urls, issue } = readLocations(atomAlternateLinks(entries), link => candidate(link.attributes?.['@_href'] ?? ''),
      text.trim() ? 'sitemap_invalid_structure' : null)
    return { ...pageList(urls, issue ?? (urls.length ? null : 'sitemap_no_page_locations')), format: 'atom' }
  }
  if (root.local !== 'rss' || root.namespace !== '' || root.attributes?.['@_version'] !== '2.0') return null
  const { elements, text } = xmlChildren(root.children, root.namespaces)
  const channels = elements.filter(element => element.namespace === '' && element.local === 'channel')
  if (text.trim() || channels.length !== 1) return { ...pageList([], 'sitemap_invalid_structure'), format: 'rss' }
  const channel = xmlChildren(channels[0].children, channels[0].namespaces)
  const entries = channel.elements.filter(entry => entry.namespace === '' && entry.local === 'item')
  const { urls, issue } = readLocations(entries, rssEntry, channel.text.trim() ? 'sitemap_invalid_structure' : null)
  return { ...pageList(urls, issue ?? (urls.length ? null : 'sitemap_no_page_locations')), format: 'rss' }
}

export function parseSitemapXml(body: string): SitemapResult {
  const empty = { urls: [], children: [], valid: false }
  if (/<!DOCTYPE|<!ENTITY/i.test(body) || XMLValidator.validate(body) !== true) return { ...empty, reason: 'sitemap_invalid_xml' }
  let nodes: XmlNode[]
  try {
    nodes = new XMLParser({ preserveOrder: true, processEntities: true, entityDecoder: sitemapEntityDecoder(),
      ignoreAttributes: false, parseTagValue: false, trimValues: false }).parse(body)
  } catch (error) {
    return { ...empty, reason: error instanceof InvalidSitemapReference ? 'sitemap_invalid_xml' : 'sitemap_parse_unavailable' }
  }
  const document = xmlChildren(nodes, new Map([['xml', 'http://www.w3.org/XML/1998/namespace']]))
  if (document.elements.length !== 1 || document.text.trim()) return { ...empty, reason: 'sitemap_invalid_xml' }
  const root = document.elements[0], core = root.namespace
  if ((core !== '' && core !== SITEMAP_NAMESPACE) || !['urlset', 'sitemapindex'].includes(root.local))
    return parseFeed(root) ?? { ...empty, reason: 'not_a_sitemap' }
  const indexed = root.local === 'sitemapindex'
  const expectedEntry = indexed ? 'sitemap' : 'url'
  const { elements, text } = xmlChildren(root.children, root.namespaces)
  const entries = elements.filter(entry => entry.namespace === core && entry.local === expectedEntry)
  const wrongStructure = text.trim() || elements.some(entry => entry.namespace === undefined ||
    entry.namespace === '' && core !== '' || entry.namespace === core && entry.local !== expectedEntry)
  const { urls, issue } = readLocations(entries, entry => sitemapEntry(entry, core), wrongStructure ? 'sitemap_invalid_structure' : null)
  return indexed ? { ...pageList([], issue), children: urls } : pageList(urls, issue)
}
