export type KnowledgeSurface = 'help' | 'docs'

export type KnowledgeSearchFilter = 'all' | KnowledgeSurface

export interface KnowledgeSearchEntry {
  surface: KnowledgeSurface
  surfaceLabel: string
  title: string
  description: string
  href: string
  keywords: string
  score?: number
}

export function searchKnowledge(
  query: string,
  entries: readonly KnowledgeSearchEntry[],
  options?: { filter?: KnowledgeSearchFilter; limit?: number }
): KnowledgeSearchEntry[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const filter = options?.filter ?? 'all'
  const limit = options?.limit ?? 12
  const terms = normalized.split(/\s+/).filter(Boolean)

  const hits: KnowledgeSearchEntry[] = []

  for (const entry of entries) {
    if (filter !== 'all' && entry.surface !== filter) continue

    const blob = `${entry.title} ${entry.description} ${entry.keywords}`.toLowerCase()
    let score = 0
    for (const term of terms) {
      if (entry.title.toLowerCase().includes(term)) score += 8
      if (entry.description.toLowerCase().includes(term)) score += 4
      if (blob.includes(term)) score += 2
    }
    if (score > 0) hits.push({ ...entry, score })
  }

  return hits
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.title.localeCompare(b.title))
    .slice(0, limit)
}
