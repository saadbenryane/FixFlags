import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WATCH_OFFER } from '@/lib/marketing/copy'
import { watchOffNotice } from '@/lib/sites/watch-offer'

const root = resolve(__dirname, '../../..')

/**
 * Watch is what distinguishes FixFlags from a one-shot report, and it stays off
 * until the customer turns it on because turning it on sends email. Home's
 * documented question is "what is FixFlags watching", so when the answer is
 * nothing yet, Home has to say so. Silence there reads as a healthy Site being
 * watched, which is the exact thing it is not.
 */
describe('Home notice for a Site that is not watched', () => {
  it('states plainly that nothing is being watched yet', () => {
    const notice = watchOffNotice({ state: 'off', siteId: 'p_example' })
    expect(notice?.title).toBe(WATCH_OFFER.title)
    expect(notice?.body).toBe(WATCH_OFFER.body)
  })

  it('sends the customer to Site settings, which owns Watch configuration', () => {
    expect(watchOffNotice({ state: 'off', siteId: 'p_example' })?.actionHref).toBe('/sites/p_example/settings')
  })

  it('stays silent for a Watch that is on, paused, delayed or waiting on quota', () => {
    // Those states already have their own labels and reasons. Restating them
    // here would be noise that teaches people to ignore this area.
    for (const state of ['watching', 'paused', 'delayed', 'quota'] as const) {
      expect(watchOffNotice({ state, siteId: 'p_example' })).toBeNull()
    }
  })

  it('does not claim Watch is running, or promise anything automatic', () => {
    const body = WATCH_OFFER.body
    expect(body).not.toMatch(/automatically|we'?ll (?:email|notify) you|always|guarantee/i)
    // The notice must not read as though Watch is already on.
    expect(`${WATCH_OFFER.title} ${body}`).not.toMatch(/\bwatching now\b|\bcurrently watching\b/i)
  })

  it('avoids the banned voice patterns', () => {
    for (const sample of [WATCH_OFFER.title, WATCH_OFFER.body, WATCH_OFFER.actionLabel]) {
      expect(sample).not.toMatch(/[\u2013\u2014]/)
      expect(sample).not.toMatch(/\b(seamless|revolutionary|game-changing|cutting-edge|unleash)\b/i)
    }
  })

  it('keeps Watch a customer choice rather than a side effect of scanning', () => {
    // Auto-enabling Watch would send email nobody asked for. The notice is a
    // statement and a link, and the board must not grow its own control.
    const board = readFileSync(resolve(root, 'components/sites/SiteBoard.tsx'), 'utf8')
    const section = board.slice(board.indexOf('offNotice ?'), board.indexOf('offNotice ?') + 700)
    expect(section).toContain('<Link')
    expect(section).not.toMatch(/onClick/)
    // Nothing in the scan path may switch Watch on as a side effect.
    const createAudit = readFileSync(resolve(root, 'lib/audit/create-audit.ts'), 'utf8')
    expect(createAudit).not.toMatch(/watchInterval\s*:/)
  })
})
