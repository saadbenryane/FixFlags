import { describe, expect, it } from 'vitest'
import { FAQ } from '@/lib/marketing/copy/faq'
import { HELP_ARTICLES } from '@/lib/help/catalog'

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\w\s]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function overlapRatio(a: string, b: string) {
  const wordsA = new Set(normalize(a).split(' ').filter(Boolean))
  const wordsB = new Set(normalize(b).split(' ').filter(Boolean))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let shared = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) shared += 1
  }
  return shared / Math.min(wordsA.size, wordsB.size)
}

describe('faq dedup', () => {
  it('links FAQ entries to canonical help or docs URLs', () => {
    expect(FAQ.every((item) => item.learnMore?.href)).toBe(true)
  })

  it('avoids duplicating full help article bodies without a learnMore link', () => {
    for (const item of FAQ) {
      for (const article of HELP_ARTICLES) {
        const articleBody = article.body
          .map((block) => {
            if ('text' in block) return block.text
            if ('items' in block) return block.items.join(' ')
            return ''
          })
          .join(' ')
        const ratio = overlapRatio(item.answer, `${article.title} ${article.excerpt} ${articleBody}`)
        if (ratio > 0.8) {
          expect(item.learnMore?.href).toBeTruthy()
        }
      }
    }
  })
})
