import { SEARCH_OBSERVATION_LIMIT, type SearchObservation } from './contracts'

/** Keep actionable failures before optional guidance, preserving source order
 * within the retained evidence. An explicit gap prevents partial recovery proof. */
export function boundSearchObservations(observations: SearchObservation[], scope: string): SearchObservation[] {
  if (observations.length <= SEARCH_OBSERVATION_LIMIT) return observations
  const rank = (item: SearchObservation) => item.disposition === 'failed' ? 0
    : item.attention.kind !== 'observation' ? 1 : item.disposition === 'unknown' ? 2 : 3
  const retained = new Set(observations.map((item, index) => ({ item, index }))
    .filter(({ item }) => item.reason !== 'observation_limit')
    .sort((a, b) => rank(a.item) - rank(b.item))
    .slice(0, SEARCH_OBSERVATION_LIMIT - 1).map(({ index }) => index))
  const template = observations[0]
  return [...observations.filter((_, index) => retained.has(index)), {
    id: 'search-observation-coverage:' + scope, checkId: 'search-observation-coverage',
    checkVersion: template.checkVersion, responsibility: template.responsibility, name: 'Search observation coverage',
    disposition: 'unknown', reason: 'observation_limit', expected: 'Complete evidence within the Search observation limit.',
    observed: 'The observation limit was reached. Remaining evidence is not certified.',
    source: template.source, collectedAt: template.collectedAt, pageUrl: template.pageUrl,
    attention: { policy: 'search', version: template.checkVersion, kind: 'observation', reason: 'observation_limit' },
    evidence: [], limitation: 'Omitted observations cannot establish absence or recovery.',
    guidance: 'Repeat the affected checks with complete evidence before confirming recovery.',
  }]
}
