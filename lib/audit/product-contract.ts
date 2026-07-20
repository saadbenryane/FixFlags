import type { PageMetadata } from './metadata'

export interface ProductContract {
  purpose: string
  firstValueJourney: string
  criticalOutcomes: string[]
  inferredAt: string
  source: 'heuristic'
}

function firstSentence(text: string, max = 160): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  const match = cleaned.match(/^[^.!?]+[.!?]?/)
  const sentence = (match?.[0] || cleaned).trim()
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence
}

/**
 * Lightweight Product Contract inference from capture metadata.
 * No LLM call: heuristics only so every audit gets a contract without extra cost.
 */
export function inferProductContract(
  url: string,
  metadata: Pick<PageMetadata, 'title' | 'description' | 'pageText' | 'h1s'> | null | undefined
): ProductContract {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  })()

  const title = metadata?.title?.trim() || ''
  const description = metadata?.description?.trim() || ''
  const h1 = metadata?.h1s?.[0]?.trim() || ''
  const pageText = metadata?.pageText?.trim() || ''

  const purposeSeed =
    firstSentence(description) ||
    firstSentence(h1) ||
    firstSentence(title) ||
    `Help visitors get value from ${host}`

  const purpose = purposeSeed.toLowerCase().startsWith('help')
    ? purposeSeed
    : `Help visitors: ${purposeSeed}`

  const pathHint = (() => {
    try {
      return new URL(url).pathname.toLowerCase()
    } catch {
      return '/'
    }
  })()

  let firstValueJourney = 'Land on the homepage, understand the offer, and take the primary CTA'
  if (/pricing|plans/.test(pathHint) || /pricing|plans/i.test(`${title} ${h1}`)) {
    firstValueJourney = 'Open pricing, compare plans, and start checkout or signup'
  } else if (/signup|sign-up|register|login/.test(pathHint)) {
    firstValueJourney = 'Reach signup, complete the form, and land in the product'
  } else if (/blog|article|news/.test(pathHint) || /blog|news/i.test(title)) {
    firstValueJourney = 'Discover an article, read it, and subscribe or share'
  }

  const criticalOutcomes: string[] = []
  if (/signup|register|start|get started|try/i.test(`${title} ${h1} ${description} ${pageText.slice(0, 800)}`)) {
    criticalOutcomes.push('A new visitor can start signup or trial without dead ends')
  }
  if (/pricing|price|plan/i.test(`${title} ${h1} ${description}`)) {
    criticalOutcomes.push('Pricing is readable and the buy or start path works')
  }
  criticalOutcomes.push('Primary navigation and the main CTA remain clickable')
  if (criticalOutcomes.length < 3) {
    criticalOutcomes.push('Share and social previews represent the product accurately')
  }

  return {
    purpose,
    firstValueJourney,
    criticalOutcomes: criticalOutcomes.slice(0, 3),
    inferredAt: new Date().toISOString(),
    source: 'heuristic',
  }
}

export function parseProductContract(data: unknown): ProductContract | null {
  if (!data || typeof data !== 'object') return null
  const c = data as Partial<ProductContract>
  if (typeof c.purpose !== 'string' || typeof c.firstValueJourney !== 'string') return null
  if (!Array.isArray(c.criticalOutcomes)) return null
  return {
    purpose: c.purpose,
    firstValueJourney: c.firstValueJourney,
    criticalOutcomes: c.criticalOutcomes.filter((o): o is string => typeof o === 'string').slice(0, 5),
    inferredAt: typeof c.inferredAt === 'string' ? c.inferredAt : new Date().toISOString(),
    source: 'heuristic',
  }
}
