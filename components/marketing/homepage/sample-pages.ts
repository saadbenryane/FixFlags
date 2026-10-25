import type { PageResult } from '@/components/sites/SitePageResults'
import { CARE_HOME as C } from '@/lib/marketing/copy/care-homepage'
import { HOMEPAGE_SAMPLE as S, SAMPLE_FLAGS, SAMPLE_CHECKED_PAGE_PATHS, type SampleFlagId } from '@/lib/marketing/copy/care-homepage'
import { HOMEPAGE_EVIDENCE } from './HomepagePrimitives'

/** Page captures remain tied to their own illustrative source. */
export function samplePages(ids: readonly SampleFlagId[], onOpen: (id: SampleFlagId, trigger: HTMLButtonElement) => void): PageResult[] {
  return SAMPLE_CHECKED_PAGE_PATHS.map(path => {
    const result = S.categories.find(card => card.id === 'site')?.results.find(result => result.label === path)
    return { url: `https://${C.boardLabel}${path}`, label: path, status: 'COMPLETED',
      capture: result?.capture ?? (path === '/' ? { src: HOMEPAGE_EVIDENCE.site, alt: S.identityAlt } : null),
      flags: ids.filter(id => SAMPLE_FLAGS[id].page === path).map(id => ({ id, title: SAMPLE_FLAGS[id].title,
        priorityBand: id === 'contact' ? 'other' : 'fix_first', onOpen: trigger => onOpen(id, trigger) })) }
  })
}
