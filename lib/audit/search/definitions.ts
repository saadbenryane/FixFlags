import type { SearchObservation } from './contracts'

/** Client-safe declaration inventory. Evaluators and parsers stay in the worker. */
export const SEARCH_DEFINITIONS = [
  { evaluator: 'presentation', responsibility: 'presentation', requiredEvidence: ['original-html', 'rendered-dom'],
    checkIds: ['title-missing', 'description-missing', 'h1-missing', 'h1-multiple', 'search-original-title', 'search-page-language'],
    assertions: ['title', 'description', 'headings'], guidance: 'title' },
  { evaluator: 'indexing', responsibility: 'indexing', requiredEvidence: ['original-html', 'rendered-dom', 'headers', 'sitemap'],
    checkIds: ['robots-blocks-indexing', 'search-indexing-source'], assertions: ['directives', 'conflicts', 'regression'], guidance: 'indexing' },
  { evaluator: 'crawl', responsibility: 'crawl', requiredEvidence: ['http', 'robots-txt'],
    checkIds: ['search-http-access', 'search-crawl-access', 'robots-txt-missing'], assertions: ['response', 'applicable-rules'], guidance: 'robots' },
  { evaluator: 'canonical', responsibility: 'canonical', requiredEvidence: ['original-html', 'rendered-dom', 'headers', 'declared-targets'],
    checkIds: ['search-canonical-invalid', 'search-canonical-conflict', 'search-canonical-target', 'canonical-missing'],
    assertions: ['declarations', 'targets', 'conflicts'], guidance: 'canonical' },
  { evaluator: 'discovery', responsibility: 'discovery', requiredEvidence: ['sitemap', 'original-html', 'rendered-dom'],
    checkIds: ['sitemap-missing', 'search-sitemap-invalid', 'search-sitemap-contents', 'search-sitemap-coverage', 'search-discovery-links'],
    assertions: ['syntax', 'contents', 'declared-targets', 'links'], guidance: 'sitemap' },
  { evaluator: 'structured-data', responsibility: 'structured-data', requiredEvidence: ['original-html', 'rendered-dom'],
    checkIds: ['search-structured-invalid', 'search-structured-source', 'search-structured-feature', 'search-structured-content', 'search-structured-coverage', 'no-structured-data', 'search-observation-coverage'],
    assertions: ['syntax', 'vocabulary', 'feature-requirements', 'content-correspondence'], guidance: 'markup' },
  { evaluator: 'google', responsibility: 'google', requiredEvidence: ['google-index', 'google-analytics'],
    checkIds: ['search-google-index', 'search-google-fetch', 'search-google-directives', 'search-google-canonical', 'search-google-rich-results', 'search-google-performance', 'indexing-failure', 'low-ctr'],
    assertions: ['indexed-version', 'rich-results', 'performance-window'], guidance: 'google' },
  { evaluator: 'cross-page', responsibility: 'presentation', requiredEvidence: ['checked-page-titles'],
    checkIds: ['search-duplicate-title'], assertions: ['checked-page-comparison'], guidance: 'duplicates' },
] as const satisfies ReadonlyArray<{
  evaluator: string; responsibility: SearchObservation['responsibility']; requiredEvidence: readonly string[];
  checkIds: readonly string[]; assertions: readonly string[]; guidance: string;
}>
export type SearchCheckIdentity = typeof SEARCH_DEFINITIONS[number]['checkIds'][number]
export const SEARCH_CHECK_REGISTRY = Object.fromEntries(SEARCH_DEFINITIONS.flatMap(definition =>
  definition.checkIds.map(id => [id, { ...definition, id, version: 2, resultSchema: 'search-observation-v2',
    applicability: 'public-source-or-authorized-provider' } as const]),
)) as unknown as Record<SearchCheckIdentity, {
  id: SearchCheckIdentity; version: 2; resultSchema: 'search-observation-v2'; applicability: string;
  evaluator: string; responsibility: SearchObservation['responsibility']; requiredEvidence: readonly string[];
  assertions: readonly string[]; guidance: string;
}>

