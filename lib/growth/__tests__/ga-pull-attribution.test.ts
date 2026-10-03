import { describe, expect, it } from 'vitest'
import { buildGaLandingJourneyArtifact } from '@/lib/growth/ga-pull'

describe('GA landing journey export', () => {
  const metadata = {
    fetchedAt: '2026-10-03T12:00:00.000Z',
    startDate: '2026-09-05',
    endDate: '2026-10-03',
  }

  it('keeps only opaque journey keys and preserves their event volume', () => {
    const journeyId = `ffj_${'a'.repeat(32)}`
    expect(
      buildGaLandingJourneyArtifact(
        [{ 'customEvent:journey_id': journeyId, eventCount: 2 }],
        metadata,
      ),
    ).toEqual({
      ...metadata,
      status: 'available',
      journeys: [{ journeyId, eventCount: 2 }],
      unattributedEventCount: 0,
    })
  })

  it('marks high-cardinality or missing dimension rows as partial', () => {
    expect(
      buildGaLandingJourneyArtifact(
        [
          { 'customEvent:journey_id': '(other)', eventCount: 7 },
          { 'customEvent:journey_id': '(not set)', eventCount: 3 },
        ],
        metadata,
      ),
    ).toEqual({
      ...metadata,
      status: 'partial',
      journeys: [],
      unattributedEventCount: 10,
    })
  })
})
