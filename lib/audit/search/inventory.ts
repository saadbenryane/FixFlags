import { SEARCH_CHECK_REGISTRY } from './definitions'

/** Old transport/helper identities are retained; the public Search workflow owns evaluation. */
export const SEARCH_HANDLED_CHECK_IDS = new Set([
  'title-missing', 'title-too-short', 'title-too-long', 'description-missing', 'description-too-short', 'description-too-long',
  'h1-missing', 'h1-multiple', 'canonical-missing', 'robots-blocks-indexing', 'no-structured-data', 'robots-txt-missing', 'sitemap-missing',
  'indexing-failure', 'soft-404', 'robots-blocked', 'noindex-meta', 'canonical-mismatch', 'low-ctr',
  ...Object.keys(SEARCH_CHECK_REGISTRY),
])
