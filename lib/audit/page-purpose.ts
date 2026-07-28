import type { PageMetadata } from './metadata'
import { getEnv } from '@/lib/env'
import { openai } from './judge-runner'
import { logger } from '@/lib/logger'

/**
 * Coarse page-purpose classification used to gate product-conversion checks.
 *
 * Deterministic checks that assume the page is a marketing / product landing
 * page (trial, pricing, sign-up risk reversal, contact-for-conversion) produce
 * false positives on placeholder domains, documentation, articles, and
 * open-source project pages. The detector only suppresses those checks when it
 * has POSITIVE evidence the page is not a product/marketing page; otherwise it
 * returns `marketing` and the checks run normally.
 *
 * The detector never inspects hostnames or specific URLs, so improvements
 * generalize to unseen sites.
 */
export type PagePurpose =
  | 'placeholder' // minimal/empty page (placeholder domain, parked, "hello world")
  | 'docs' // documentation / API reference / guide
  | 'article' // blog post / changelog / news
  | 'oss' // open-source project page centered on a code repository
  | 'marketing' // product / marketing landing (default): conversion checks fire
  | 'unknown'

export interface PagePurposeResult {
  purpose: PagePurpose
  reasons: string[]
}

const DOCS_PATH_RE =
  /\/(?:docs|documentation|api(?:\/|$|[?_-])|reference|guides?|tutorial|developer)(?:\/|$|\?)/i
const DOCS_TITLE_RE =
  /\b(?:docs|documentation|api\s+reference|reference|developer\s+guide|guides?)\b/i
const ARTICLE_PATH_RE =
  /\/(?:blog|posts?|articles?|news|changelog|changelogs|updates)(?:\/|$|\?)/i
const ARTICLE_TYPES = new Set([
  'Article',
  'BlogPosting',
  'NewsArticle',
  'TechArticle',
  'Report',
])
const GITHUB_REPO_RE = /github\.com\/[\w.-]+\/[\w.-]+/i
const GITHUB_STAR_RE =
  /\b(star\s+(?:on\s+|us\s+on\s+)?github|github\s+stars?|star\s+the\s+(?:repo|project)|star\s+repo)\b/i

export function detectPagePurpose(
  meta: PageMetadata,
  url: string
): PagePurposeResult {
  const pageText = meta.pageText ?? ''
  const words = pageText.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const links = meta.links ?? []
  const linkCount = links.length
  const imageCount = (meta.images ?? []).length
  const ctaCount = (meta.ctaTexts ?? []).length
  const navCount = meta.navLandmarkCount ?? 0

  const jsonTypes = new Set(
    (meta.structuredDataTypes ?? [])
      .filter((t): t is string => typeof t === 'string')
      .flatMap((t) => t.split(/\s+/))
  )

  let path = url
  try {
    path = new URL(url).pathname + '?' + (new URL(url).search ? '' : '')
  } catch {
    // keep raw url
  }
  const title = meta.title ?? ''

  // 1. Placeholder / minimal page: too little content to be a real marketing
  //    page. example.com lives here. Note: a lone generic link such as
  //    "Learn more" still counts as a CTA in metadata, so we do not require
  //    zero CTAs. The overall thinness of the page is the signal.
  if (wordCount < 60 && linkCount < 5 && imageCount < 2 && navCount <= 1) {
    return {
      purpose: 'placeholder',
      reasons: [
        `minimal page (words=${wordCount}, links=${linkCount}, images=${imageCount}, nav=${navCount}, ctas=${ctaCount})`,
      ],
    }
  }

  // 2. Documentation / API reference
  if (
    DOCS_PATH_RE.test(path) ||
    DOCS_TITLE_RE.test(title) ||
    jsonTypes.has('TechArticle')
  ) {
    return {
      purpose: 'docs',
      reasons: [
        `docs signal (path=${DOCS_PATH_RE.test(path)}, title=${DOCS_TITLE_RE.test(
          title
        )}, jsonld=${jsonTypes.has('TechArticle')})`,
      ],
    }
  }

  // 3. Article / blog post / changelog
  if (ARTICLE_PATH_RE.test(path) || [...jsonTypes].some((t) => ARTICLE_TYPES.has(t))) {
    return {
      purpose: 'article',
      reasons: [
        `article signal (path=${ARTICLE_PATH_RE.test(path)}, jsonld=${[...jsonTypes]
          .filter((t) => ARTICLE_TYPES.has(t))
          .join('|')})`,
      ],
    }
  }

  // 4. Open-source project page: a GitHub repo link signals the page promotes
  //    a codebase rather than a commercial conversion funnel. Such pages
  //    legitimately lack trial/pricing CTAs. To avoid over-suppressing a SaaS
  //    homepage that merely links to its repo, require the absence of any
  //    commercial signal (trial, pricing, purchase) in the page text.
  const githubLink = links.some((l) => GITHUB_REPO_RE.test(l.href))
  const githubStarText = GITHUB_STAR_RE.test(pageText)
  const githubInCta = (meta.ctaTexts ?? []).some((c) => /github/i.test(c))
  const hasCommercialSignal =
    // Note: "subscribe" is intentionally excluded. Newsletters are common on
    // docs/OSS pages and do not indicate a commercial conversion funnel.
    /(free trial|try free|start free|no credit card|free plan|\bpricing\b|\bbuy\b|\bcart\b|\bcheckout\b|\bpurchase\b|\bbilling\b)/i.test(
      pageText
    )
  if (githubLink && !hasCommercialSignal) {
    return {
      purpose: 'oss',
      reasons: [
        `oss signal (github link=${githubLink}, star text=${githubStarText}, github cta=${githubInCta}, commercial=${hasCommercialSignal})`,
      ],
    }
  }

  // 5. Personal / portfolio / advisory page: personal pronouns in the headline,
  //    case-study or portfolio sections, and the absence of commercial signals
  //    indicate a personal site that legitimately lacks conversion CTAs.
  //    Commercial intent is checked only in the headline/title and CTA text,
  //    NOT in body content, because portfolio pages naturally mention "pricing"
  //    or "buy" in case-study descriptions without having conversion intent.
  const h1Text = (meta.h1s ?? [])[0] ?? ''
  const titleText = meta.title ?? ''
  const headlineAndTitle = `${h1Text} ${titleText}`.toLowerCase()
  const hasPersonalPronouns = /\b(i'm|i am|my\s+(?:work|story|journey|portfolio|approach)|from vision|case stud)\b/i.test(headlineAndTitle)
  const hasPortfolioSections = /\b(case stud|portfolio|selected work|journal|blog)\b/i.test(pageText.slice(0, 2000))
  const headlineAndCtas = `${headlineAndTitle} ${(meta.ctaTexts ?? []).join(' ')}`.toLowerCase()
  const hasCommercialIntent =
    /(free trial|try free|start free|no credit card|free plan|\bpricing\b|\bbuy\b|\bcart\b|\bcheckout\b|\bpurchase\b|\bbilling\b)/i.test(
      headlineAndCtas
    )
  const hasNoCommercialIntent = !hasCommercialIntent && ctaCount === 0
  if (hasPersonalPronouns && hasPortfolioSections && hasNoCommercialIntent) {
    return {
      purpose: 'article',
      reasons: [
        `personal/portfolio signal (pronouns=${hasPersonalPronouns}, portfolio=${hasPortfolioSections}, commercial=${hasCommercialIntent})`,
      ],
    }
  }

  return {
    purpose: 'marketing',
    reasons: ['default marketing; no strong non-marketing signal'],
  }
}

/** True when product-conversion checks should run. */
export function isProductPage(p: PagePurpose): boolean {
  return p === 'marketing' || p === 'unknown'
}

const LLM_PURPOSE_VALUES = ['placeholder', 'docs', 'article', 'oss', 'marketing'] as const

/**
 * Lightweight LLM classifier for pages where the heuristic result was `marketing`
 * (the ambiguous fallback). Returns the classified purpose, or null if the LLM
 * call fails or is unavailable. Gated behind USE_LLM_PAGE_PURPOSE env flag.
 */
export async function classifyPagePurposeWithLlm(
  meta: PageMetadata,
  url: string
): Promise<PagePurposeResult | null> {
  const env = getEnv()
  if (!env.USE_LLM_PAGE_PURPOSE) return null
  if (!openai) return null

  const title = meta.title ?? 'untitled'
  const text = (meta.pageText ?? '').slice(0, 800)
  const linkCount = (meta.links ?? []).length
  const imageCount = (meta.images ?? []).length
  const words = text.split(/\s+/).length

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 10,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `Classify this web page as exactly one word from this list: placeholder, docs, article, oss, marketing.

Page title: ${title}
URL path: ${url}
Links: ${linkCount}, Images: ${imageCount}, Words: ${words}
First 500 chars of text: ${text.slice(0, 500)}

Respond with only one word.`,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content?.trim().toLowerCase() ?? ''
    const purpose = LLM_PURPOSE_VALUES.find((v) => raw.includes(v))
    if (purpose) {
      return {
        purpose,
        reasons: [`LLM classified as ${purpose}`],
      }
    }
    return null
  } catch (err) {
    logger.warn('LLM page-purpose classification failed, falling back to heuristics', err)
    return null
  }
}