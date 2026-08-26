import { describe, expect, it } from 'vitest'
import { buildHelpKnowledgeEntries, docsEntriesToKnowledge, mergeKnowledgeEntries } from '@/lib/knowledge/entries'
import { searchKnowledge } from '@/lib/knowledge/search'

describe('knowledge search', () => {
  const entries = mergeKnowledgeEntries(
    buildHelpKnowledgeEntries(),
    docsEntriesToKnowledge([
      {
        title: 'Getting started',
        description: 'Run your first product review',
        href: '/docs/getting-started',
        keywords: 'workflow start',
      },
    ])
  )

  it('returns help and docs results together', () => {
    const hits = searchKnowledge('billing', entries)
    expect(hits.some((hit) => hit.surface === 'help')).toBe(true)
  })

  it('filters by surface', () => {
    const hits = searchKnowledge('getting started', entries, { filter: 'docs' })
    expect(hits.every((hit) => hit.surface === 'docs')).toBe(true)
  })
})
