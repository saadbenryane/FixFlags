import { describe, expect, it } from 'vitest'
import { CARD_CATALOG, STARTER_BOARD_CARDS } from '@/lib/sites/card-areas'
import {
  boardCardFooter,
  boardCardHeaderText,
  boardCardStatusText,
  boardFlagPrompt,
  buildBoardCards,
  starterBoardNames,
} from '@/lib/sites/board-card'
import { CARE_HOME } from '@/lib/marketing/copy'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import type { CoverageFact } from '@/lib/sites/coverage'
import type { SiteFlagSeed } from '@/lib/sites/coverage'

function fact(area: CoverageFact['area'], state: CoverageFact['state'], label: string): CoverageFact {
  return {
    area,
    state,
    label,
    detail: `${area} detail`,
    checkedAt: '2026-09-08T12:00:00.000Z',
    openFlagCount: state === 'problem' ? 1 : 0,
    score: null,
    evidenced: state !== 'unknown',
  }
}

const conversionFlag: SiteFlagSeed = {
  id: 'flag-1',
  improvementId: null,
  checkId: 'form-no-confirmation',
  rubric: 'MESSAGE',
  severity: 'CRITICAL',
  impactTag: 'CONVERSION',
  problem: 'No confirmation after contact',
  evidence: 'The form posted with 200 and the page did not change.',
  whyItMatters: 'Visitors never see that it worked.',
  fix: 'Show a confirmation after submit.',
  pageUrl: 'https://everydaygoods.example/contact',
  status: 'OPEN',
  area: 'conversion',
}

describe('board card contract', () => {
  it('names starter cards from CARD_CATALOG in board order', () => {
    expect(starterBoardNames()).toEqual([
      'Site',
      'Conversion',
      'Security',
      'Search',
      'Performance',
      'Tracking',
    ])
    expect(STARTER_BOARD_CARDS.map((id) => CARD_CATALOG[id].name)).toEqual(starterBoardNames())
  })

  it('keeps homepage example labels on the same catalog names', () => {
    expect([
      CARE_HOME.site.label,
      CARE_HOME.flag.name,
      ...CARE_HOME.cards.map((card) => card.name),
    ]).toEqual(starterBoardNames())
  })

  it('never uses the host as the Site card name', () => {
    const cards = buildBoardCards({
      siteId: 'p_example',
      inFlight: true,
      hasLastKnown: false,
      health: { state: 'checking', answer: SITE_BOARD_COPY.learning, statusLabel: SITE_BOARD_COPY.learning },
      coverageByArea: new Map(),
      flags: [],
      outcomes: [],
      pageCount: 12,
      captureUrl: '/api/screenshots/audit-1/desktop',
      checkedAt: null,
    })
    const site = cards[0]
    expect(site?.name).toBe('Site')
    expect(site?.answer).toBe(SITE_BOARD_COPY.pagesLoading)
    expect(site?.status).toBe(SITE_BOARD_COPY.pagesLoading)
    expect(site?.captureUrl).toBe('/api/screenshots/audit-1/desktop')
    expect(site?.captureUrl).not.toMatch(/\/marketing\//)
  })

  it('gives Conversion the Flag chrome when it has a problem', () => {
    const cards = buildBoardCards({
      siteId: 'p_example',
      inFlight: false,
      hasLastKnown: false,
      health: { state: 'problem', answer: '1 thing needs attention', statusLabel: 'Needs attention' },
      coverageByArea: new Map([
        ['conversion', fact('conversion', 'problem', 'Needs a fix')],
        ['security', fact('security', 'healthy', 'Protected')],
      ]),
      flags: [conversionFlag],
      outcomes: [
        {
          id: 'out-1',
          name: 'Get in touch',
          slug: 'get-in-touch',
          description: null,
          inferenceSource: 'heuristic',
          confirmedAt: null,
          pageIds: [],
          pageUrls: ['https://everydaygoods.example/contact'],
        },
      ],
      pageCount: 12,
      captureUrl: null,
      checkedAt: '2026-09-08T12:00:00.000Z',
    })
    const conversion = cards.find((card) => card.id === 'conversion')
    expect(conversion?.state).toBe('problem')
    expect(conversion?.status).toBe(SITE_BOARD_COPY.flagStatus)
    expect(conversion?.answer).toBe(conversionFlag.problem)
    expect(conversion?.problem?.outcomeName).toBe('Get in touch')
    expect(conversion?.problem?.href).toBe('/sites/p_example/flags/flag-1')
    expect(conversion?.flagChips).toEqual([
      { id: 'flag-1', title: conversionFlag.problem, href: '/sites/p_example/flags/flag-1' },
    ])
    expect(conversion?.sources).toEqual([SITE_BOARD_COPY.browserSource])
    const tracking = cards.find((card) => card.id === 'tracking')
    expect(tracking?.sources).toEqual([SITE_BOARD_COPY.browserSource])
    const withAnalytics = buildBoardCards({
      siteId: 'p_example',
      inFlight: false,
      hasLastKnown: false,
      health: { state: 'healthy', answer: SITE_BOARD_COPY.lookingGood, statusLabel: SITE_BOARD_COPY.lookingGood },
      coverageByArea: new Map([['tracking', fact('tracking', 'healthy', 'Key events are arriving')]]),
      flags: [],
      outcomes: [],
      pageCount: 12,
      captureUrl: null,
      checkedAt: '2026-09-08T12:00:00.000Z',
      detected: { analytics: ['Google Analytics'] },
    }).find((card) => card.id === 'tracking')
    expect(withAnalytics?.sources).toEqual(['Google Analytics'])
    expect(cards.some((card) => card.id === 'uptime')).toBe(true)
    expect(cards.some((card) => card.id === 'accessibility')).toBe(true)
  })

  it('keeps unknown areas unknown when there are no Flags', () => {
    const cards = buildBoardCards({
      siteId: 'p_example',
      inFlight: false,
      hasLastKnown: false,
      health: {
        state: 'unknown',
        answer: 'Checked some areas. Others are not verified yet.',
        statusLabel: 'Coverage incomplete',
      },
      coverageByArea: new Map([['security', fact('security', 'unknown', 'Not checked yet')]]),
      flags: [],
      outcomes: [],
      pageCount: 0,
      captureUrl: null,
      checkedAt: '2026-09-08T12:00:00.000Z',
    })
    expect(cards.find((card) => card.id === 'security')?.state).toBe('unknown')
    expect(cards.find((card) => card.id === 'site')?.name).toBe('Site')
    expect(boardCardFooter({ openFlagCount: 0, checkedAt: null })).toBe('Not checked yet')
    expect(boardCardStatusText('attention')).toBe('Needs attention')
    expect(boardCardStatusText('problem')).toBe(SITE_BOARD_COPY.flagStatus)
    expect(boardCardHeaderText('healthy', null, '2026-09-08T12:00:00.000Z', Date.parse('2026-09-08T12:00:20.000Z'))).toBe(
      SITE_BOARD_COPY.lastChecked
    )
    expect(boardCardHeaderText('attention', null, '2026-09-08T12:00:00.000Z')).toBeNull()
    expect(boardFlagPrompt({
      problem: conversionFlag.problem,
      whyItMatters: conversionFlag.whyItMatters,
      evidence: conversionFlag.evidence,
      fix: conversionFlag.fix,
      pageUrl: conversionFlag.pageUrl,
      expectedBehavior: 'A confirmation appears after submit.',
    })).toMatch(/Copying this does not resolve/)
  })
})
