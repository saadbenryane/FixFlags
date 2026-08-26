import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  AGENT_COPY_LEAD,
  buildEditorHandoffPrompt,
  buildPlanBundleHeader,
  locateFlagForEditor,
  stripInventedFilePaths,
  taskBodyForFlag,
} from '@/lib/audit/editor-handoff'
import { buildPlanModePrompt } from '@/lib/audit/priority-flags'
import type { RankableFlag } from '@/lib/audit/flag-types'

const FINDING_LEAD =
  'This is a FixFlags finding from the live page, not a guess about your repo.'

function flag(overrides: Partial<RankableFlag> = {}): RankableFlag {
  return {
    id: 'f1',
    checkId: 'h1-generic',
    rubric: 'MESSAGE',
    severity: 'IMPORTANT',
    problem: 'Generic headline',
    evidence: 'The H1 reads "Build with AI".',
    fix: 'Replace the H1 with an audience-and-outcome statement.',
    ...overrides,
  }
}

describe('editor-handoff', () => {
  it('grounds a hero H1 on the live page and asks the agent to search then plan', () => {
    const prompt = buildEditorHandoffPrompt(flag(), {
      url: 'https://acme.com/',
      pageType: 'homepage',
    })
    assert.match(prompt, /This is a FixFlags finding from the live page/)
    assert.match(prompt, /Page: https:\/\/acme\.com\/ \(homepage\)/)
    assert.match(prompt, /Section: Hero headline \(H1\)/)
    assert.match(prompt, /Current: the H1 reads "Build with AI"/)
    assert.match(prompt, /Task: Replace the H1 with an audience-and-outcome statement/)
    assert.match(prompt, /Search the repo for the exact text "Build with AI"/)
    assert.match(prompt, /Make a short plan/)
    assert.match(prompt, /Implement only that plan/)
    assert.doesNotMatch(prompt, /## Goal/)
    assert.equal(prompt.includes('\u2014'), false)
  })

  it('names mobile viewport for a below-fold CTA and omits a guessed section quote', () => {
    const prompt = buildEditorHandoffPrompt(
      flag({
        checkId: 'cta-below-fold-mobile',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        problem: 'CTA below fold',
        evidence: 'On mobile (375×812), the primary CTA starts below the first screen.',
        fix: 'Keep the primary CTA visible in the first 812px at 375px width.',
      }),
      { url: 'https://acme.com/' }
    )
    assert.match(prompt, /Viewport: mobile 375x812/)
    assert.match(prompt, /Section: Primary call-to-action button/)
    assert.doesNotMatch(prompt, /^Current:/m)
    assert.match(prompt, /layout that renders on mobile/)
    assert.match(prompt, /Do not restyle desktop/)
  })

  it('uses document head for metadata Flags and does not invent a visual section', () => {
    const prompt = buildEditorHandoffPrompt(
      flag({
        checkId: 'robots-blocks-indexing',
        rubric: 'REACH',
        severity: 'CRITICAL',
        problem: 'Robots meta tag is blocking indexing',
        evidence: 'meta name="robots" content="noindex"',
        fix: 'Allow indexing and following on the public launch page.',
        verificationRule: 'View page source; robots meta should not include noindex.',
      }),
      { url: 'https://acme.com/' }
    )
    assert.match(prompt, /Section: document head/)
    assert.doesNotMatch(prompt, /Hero headline/)
    assert.doesNotMatch(prompt, /^Current:/m)
    assert.match(prompt, /page metadata in the document head/)
    assert.match(prompt, /Verify: View page source/)
  })

  it('falls back to the audit URL when the Flag has no pageUrl', () => {
    const location = locateFlagForEditor(flag({ pageUrl: null }), {
      url: 'https://fallback.example/',
    })
    assert.equal(location.pageUrl, 'https://fallback.example/')
  })

  it('strips invented file paths from the task body', () => {
    assert.equal(
      stripInventedFilePaths(
        'Fix the hero headline in app/page.tsx to name the audience.'
      ),
      'Fix the hero headline to name the audience.'
    )
    const prompt = buildEditorHandoffPrompt(
      flag({
        agentPrompt: 'Rewrite the H1 in app/page.tsx to name the audience.',
        fix: 'Rewrite the H1.',
      }),
      { url: 'https://acme.com/' }
    )
    assert.doesNotMatch(prompt, /app\/page\.tsx/)
    assert.match(prompt, /Rewrite the H1 to name the audience/)
    assert.match(prompt, /Do not invent file paths/)
  })

  it('prefers a measured evidence-target label over the checkId fallback', () => {
    const location = locateFlagForEditor(
      flag({
        evidenceTargets: [
          {
            kind: 'element',
            source: 'measured',
            device: 'desktop',
            rect: { x: 0.1, y: 0.2, width: 0.4, height: 0.08 },
            selector: 'h1',
            label: 'Pricing headline',
          },
        ],
      })
    )
    assert.equal(location.section, 'Pricing headline')
  })

  it('uses measured selector and node text as the search key', () => {
    const prompt = buildEditorHandoffPrompt(
      flag({
        evidence: 'The headline is generic.',
        evidenceTargets: [
          {
            kind: 'element',
            source: 'measured',
            device: 'desktop',
            rect: { x: 0.1, y: 0.2, width: 0.4, height: 0.08 },
            selector: 'h1.hero-title',
            label: 'Hero headline',
            text: 'Welcome aboard',
          },
        ],
      }),
      { url: 'https://acme.com/' }
    )
    assert.match(prompt, /Current: the H1 reads "Welcome aboard"/)
    assert.match(prompt, /Search the repo for the exact text "Welcome aboard" \(selector h1\.hero-title\)/)
  })

  it('lists extra occurrence URLs', () => {
    const location = locateFlagForEditor(flag({ pageUrl: 'https://acme.com/pricing' }), {
      url: 'https://acme.com/',
      pageUrls: ['https://acme.com/pricing', 'https://acme.com/about'],
    })
    assert.equal(location.pageUrl, 'https://acme.com/pricing')
    assert.deepEqual(location.extraPageUrls, ['https://acme.com/about'])
  })

  it('returns an empty handoff when the Flag has no usable prompt', () => {
    assert.equal(
      buildEditorHandoffPrompt(
        flag({ fix: undefined, agentPrompt: null, problem: 'No prompt yet' })
      ),
      ''
    )
  })

  it('keeps display and clipboard assembly identical for a resolved task', () => {
    const assembled = buildEditorHandoffPrompt(flag(), { url: 'https://acme.com/' })
    assert.equal(assembled, buildEditorHandoffPrompt(flag(), { url: 'https://acme.com/' }))
    assert.equal(taskBodyForFlag(flag()).includes('app/page.tsx'), false)
  })
})

describe('buildPlanModePrompt handoff', () => {
  it('includes the reviewed URL and asks to plan all items first', () => {
    const result = buildPlanModePrompt(
      [
        flag({
          id: 'b',
          severity: 'CRITICAL',
          problem: 'Blocker',
          evidence: 'CTA is dead',
          agentPrompt: 'Fix blocker',
        }),
        flag({
          id: 'a',
          checkId: 'title-too-short',
          severity: 'POLISH',
          rubric: 'REACH',
          problem: 'Low',
          agentPrompt: 'Fix low',
          confidence: 0.4,
        }),
      ],
      { url: 'https://acme.com', pageType: 'homepage' }
    )
    assert.match(result, new RegExp(`^${FINDING_LEAD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.match(result, /Page: https:\/\/acme\.com \(homepage\)/)
    assert.match(result, /Plan all of these changes before implementing any of them/)
    assert.match(result, /1\. \[CRITICAL/)
    assert.ok(result.indexOf('Blocker') < result.indexOf('Low'))
    assert.equal(result.includes('\u2014'), false)
  })
})

describe('plan bundle header', () => {
  it('starts with the finding lead', () => {
    assert.equal(AGENT_COPY_LEAD.startsWith('This is a FixFlags finding'), true)
    assert.match(buildPlanBundleHeader({ url: 'https://x.com' }), /Page: https:\/\/x\.com/)
  })
})
