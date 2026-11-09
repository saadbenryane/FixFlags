import { parseActiveHtmlDocument } from './html-document'

const MISSING_PAGE = /page not found|not found|doesn't exist|does not exist|404|no longer available|we couldn't find/i
const MISSING_PAGE_LABEL = /^(?:(?:error )?404\s*[:–-]?\s*)?(?:page not found|this page (?:was not found|could not be found|does not exist|doesn['’]t exist))\.?$/i
const MISSING_RESOURCE_LABEL = /^(?:error )?404\s*[:–-]?\s*not found\.?$/i

/** Shared missing-page wording for original responses and bounded visible copy. */
export function hasMissingPageContent(headings: readonly string[], text: string): boolean {
  return headings.some(heading => MISSING_PAGE.test(heading)) ||
    headings.length > 0 && MISSING_PAGE.test(text.slice(0, 400))
}

export function isExplicitMissingPageLabel(text: string): boolean {
  const label = text.replace(/\s+/g, ' ').trim()
  return MISSING_PAGE_LABEL.test(label) || MISSING_RESOURCE_LABEL.test(label)
}

export function supportsPageHeadingEvidence(contentType?: string): boolean {
  const mediaType = contentType?.split(';')[0].trim().toLowerCase()
  return !mediaType || mediaType === 'text/html' || mediaType === 'application/xhtml+xml'
}

/** A truncated document can retain a closed label. Parser-implied closures
 * at the collection boundary cannot establish what a label actually says. */
export function inspectPageResponseHeadings(html: string, contentType?: string, complete = true) {
  if (!supportsPageHeadingEvidence(contentType)) return 'clear'
  const { document: $ } = parseActiveHtmlDocument(html)
  $('script, style, svg, [hidden], [inert]').remove()
  const labels = $('head > title, body h1').toArray()
  const observed = labels.filter(element => complete || element.sourceCodeLocation?.endTag)
    .map(element => ({ name: element.name, text: $(element).text() }))
  if (observed.some(({ text }) => isExplicitMissingPageLabel(text))) return 'missing'
  if (complete) return 'clear'
  return observed.length === labels.length &&
    observed.some(label => label.name === 'h1' && label.text.trim()) ? 'clear' : 'incomplete'
}
