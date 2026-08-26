import 'server-only'

import { buildDocsSearchIndex } from '@/lib/docs/content'
import {
  buildHelpKnowledgeEntries,
  docsEntriesToKnowledge,
  mergeKnowledgeEntries,
} from '@/lib/knowledge/entries'

export {
  buildHelpKnowledgeEntries,
  docsEntriesToKnowledge,
  mergeKnowledgeEntries,
} from '@/lib/knowledge/entries'

/** Unified help + docs search index for hub, inner help pages, and docs shell. */
export async function buildKnowledgeIndex() {
  const docsEntries = docsEntriesToKnowledge(await buildDocsSearchIndex())
  return mergeKnowledgeEntries(buildHelpKnowledgeEntries(), docsEntries)
}
