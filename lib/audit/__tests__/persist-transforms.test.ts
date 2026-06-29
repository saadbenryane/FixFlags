import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  aiSeverityToEnum,
  aiImpactToEnum,
  buildDeterministicFlagRow,
  buildAiFlagRow,
} from '@/lib/audit/persist'
import { flagFingerprint } from '@/lib/audit/deduplicate'
import type { DeterministicFlag } from '@/lib/audit/checks'
import type { JudgeOutput } from '@/lib/audit/judge-schema'

// ── aiSeverityToEnum ─────────────────────────────────────────────

describe('aiSeverityToEnum', () => {
  it('maps known values directly', () => {
    assert.equal(aiSeverityToEnum('CRITICAL'), 'CRITICAL')
    assert.equal(aiSeverityToEnum('IMPORTANT'), 'IMPORTANT')
    assert.equal(aiSeverityToEnum('POLISH'), 'POLISH')
  })

  it('maps AI-style severity words to closest FixFlags severity', () => {
    assert.equal(aiSeverityToEnum('HIGH'), 'IMPORTANT')
    assert.equal(aiSeverityToEnum('MEDIUM'), 'POLISH')
    assert.equal(aiSeverityToEnum('LOW'), 'POLISH')
    assert.equal(aiSeverityToEnum('INFO'), 'POLISH')
  })

  it('falls back to POLISH for unknown values', () => {
    assert.equal(aiSeverityToEnum('BLOCKER'), 'POLISH')
    assert.equal(aiSeverityToEnum(''), 'POLISH')
    assert.equal(aiSeverityToEnum('CRITICAL_BUG'), 'POLISH')
  })
})

// ── aiImpactToEnum ───────────────────────────────────────────────

describe('aiImpactToEnum', () => {
  it('returns known impact tags', () => {
    assert.equal(aiImpactToEnum('CONVERSION'), 'CONVERSION')
    assert.equal(aiImpactToEnum('REVENUE'), 'REVENUE')
    assert.equal(aiImpactToEnum('TRUST'), 'TRUST')
    assert.equal(aiImpactToEnum('MEASUREMENT'), 'MEASUREMENT')
    assert.equal(aiImpactToEnum('SHARING'), 'SHARING')
    assert.equal(aiImpactToEnum('SEO'), 'SEO')
    assert.equal(aiImpactToEnum('ACCESSIBILITY'), 'ACCESSIBILITY')
  })

  it('returns null for unknown tags', () => {
    assert.equal(aiImpactToEnum('PERFORMANCE'), null)
    assert.equal(aiImpactToEnum('SECURITY'), null)
    assert.equal(aiImpactToEnum(null), null)
    assert.equal(aiImpactToEnum(undefined), null)
  })
})

// ── flagFingerprint ──────────────────────────────────────────────

describe('flagFingerprint', () => {
  it('produces the same hash for identical inputs', () => {
    const a = flagFingerprint({ rubric: 'EXPERIENCE', checkId: 'title-missing', problem: 'Title is missing' })
    const b = flagFingerprint({ rubric: 'EXPERIENCE', checkId: 'title-missing', problem: 'Title is missing' })
    assert.equal(a, b)
  })

  it('produces different hashes for different checkIds', () => {
    const a = flagFingerprint({ rubric: 'EXPERIENCE', checkId: 'title-missing', problem: 'Title is missing' })
    const b = flagFingerprint({ rubric: 'EXPERIENCE', checkId: 'description-missing', problem: 'Title is missing' })
    assert.notEqual(a, b)
  })

  it('produces different hashes for different rubrics', () => {
    const a = flagFingerprint({ rubric: 'MESSAGE', checkId: 'title-missing', problem: 'Title is missing' })
    const b = flagFingerprint({ rubric: 'REACH', checkId: 'title-missing', problem: 'Title is missing' })
    assert.notEqual(a, b)
  })

  it('hashes by problem words when checkId is null (AI flag)', () => {
    const a = flagFingerprint({ rubric: 'MESSAGE', checkId: null, problem: 'Slow page load time' })
    const b = flagFingerprint({ rubric: 'MESSAGE', checkId: null, problem: 'Slow page load time' })
    assert.equal(a, b)
  })

  it('produces different hashes for different AI problems', () => {
    const a = flagFingerprint({ rubric: 'MESSAGE', checkId: null, problem: 'Slow page load time' })
    const b = flagFingerprint({ rubric: 'MESSAGE', checkId: null, problem: 'Missing testimonials section' })
    assert.notEqual(a, b)
  })

  it('includes pageUrl in hash when provided', () => {
    const a = flagFingerprint({ rubric: 'MESSAGE', checkId: 'title-missing', problem: 'Title missing', pageUrl: '/page1' })
    const b = flagFingerprint({ rubric: 'MESSAGE', checkId: 'title-missing', problem: 'Title missing', pageUrl: '/page2' })
    assert.notEqual(a, b)
  })
})

// ── Severity ↔ Score consistency ────────────────────────────────

describe('severity scoring consistency', () => {
  it('CRITICAL maps to the highest penalty tier', () => {
    const criticalSeverities = ['CRITICAL']
    const lower = ['IMPORTANT', 'POLISH']
    for (const c of criticalSeverities) {
      for (const l of lower) {
        assert.notEqual(aiSeverityToEnum(c), aiSeverityToEnum(l))
      }
    }
  })

  it('every valid AI severity produces a known FixFlags severity', () => {
    const valid = ['CRITICAL', 'IMPORTANT', 'POLISH', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
    const results = valid.map((s) => aiSeverityToEnum(s))
    assert.ok(results.every((r) => ['CRITICAL', 'IMPORTANT', 'POLISH'].includes(r)))
  })
})

// ── buildDeterministicFlagRow ─────────────────────────────────────

function makeDet(partial: Partial<DeterministicFlag> & Pick<DeterministicFlag, 'checkId' | 'problem'>): DeterministicFlag {
  return {
    rubric: 'REACH',
    impactTag: null,
    severity: 'IMPORTANT',
    evidence: partial.evidence ?? partial.problem,
    fix: 'Fix it',
    confidence: 1,
    source: 'DETERMINISTIC',
    ...partial,
  }
}

function pageMap(entries: [string, string][]): Map<string, string> {
  return new Map(entries.map(([url, id]) => [url, id]))
}

function rubricMap(entries: [string, string][]): Map<string, string> {
  return new Map(entries)
}

describe('buildDeterministicFlagRow', () => {
  it('maps basic flag fields correctly', () => {
    const flag = makeDet({ checkId: 'title-missing', rubric: 'REACH', problem: 'Page title is missing', severity: 'CRITICAL' })
    const row = buildDeterministicFlagRow(flag, 0, new Map(), new Map())

    assert.equal(row.checkId, 'title-missing')
    assert.equal(row.rubric, 'REACH')
    assert.equal(row.severity, 'CRITICAL')
    assert.equal(row.problem, 'Page title is missing')
    assert.equal(row.source, 'DETERMINISTIC')
    assert.equal(row.position, 0)
  })

  it('resolves whyItMatters from lookup when no enrichment', () => {
    const flag = makeDet({ checkId: 'title-missing', problem: 'Title is missing' })
    const row = buildDeterministicFlagRow(flag, 0, new Map(), new Map())
    assert.ok(row.whyItMatters.length > 10)
    assert.ok(row.whyItMatters.includes('Search results'))
  })

  it('prefers enrichment whyItMatters when present', () => {
    const flag = makeDet({ checkId: 'title-missing', problem: 'Title is missing' })
    const enrichment = {
      checkId: 'title-missing',
      whyItMatters: 'Custom business impact explanation',
      agentPrompt: 'Custom fix prompt',
      verificationRule: 'Custom verification rule',
    }
    const row = buildDeterministicFlagRow(flag, 0, new Map(), new Map(), enrichment)
    assert.equal(row.whyItMatters, 'Custom business impact explanation')
    assert.equal(row.agentPrompt, 'Custom fix prompt')
    assert.equal(row.verificationRule, 'Custom verification rule')
  })

  it('falls back to lookup when enrichment has generic whyItMatters', () => {
    const flag = makeDet({ checkId: 'title-missing', problem: 'Title is missing' })
    const enrichment = {
      checkId: 'title-missing',
      whyItMatters: 'This affects the message quality of your page', // matches GENERIC_WHY_PATTERN
      agentPrompt: 'Custom fix prompt',
    }
    const row = buildDeterministicFlagRow(flag, 0, new Map(), new Map(), enrichment)
    assert.notEqual(row.whyItMatters, enrichment.whyItMatters, 'should not use generic enrichment text')
    assert.ok(row.whyItMatters.includes('Search results'))
  })

  it('resolves pageId from pageUrl map', () => {
    const flag = makeDet({
      checkId: 'title-missing',
      problem: 'Title is missing',
      pageUrl: 'https://example.com/page1',
    })
    const pMap = pageMap([['https://example.com/page1', 'page-123']])
    const row = buildDeterministicFlagRow(flag, 0, pMap, new Map())
    assert.equal(row.pageId, 'page-123')
  })

  it('returns null pageId when pageUrl is not in map', () => {
    const flag = makeDet({
      checkId: 'title-missing',
      problem: 'Title is missing',
      pageUrl: 'https://example.com/unknown',
    })
    const row = buildDeterministicFlagRow(flag, 0, new Map(), new Map())
    assert.equal(row.pageId, null)
  })

  it('returns null pageId when flag has no pageUrl', () => {
    const flag = makeDet({ checkId: 'title-missing', problem: 'Title is missing' })
    const row = buildDeterministicFlagRow(flag, 0, new Map(), new Map())
    assert.equal(row.pageId, null)
  })

  it('returns null verificationRule when enrichment and lookup both miss', () => {
    const flag = makeDet({ checkId: 'fake-unknown-check', problem: 'Unknown issue' })
    const row = buildDeterministicFlagRow(flag, 0, new Map(), new Map())
    assert.equal(row.verificationRule, null)
  })

  it('increments position for each flag', () => {
    const flag = makeDet({ checkId: 'title-missing', problem: 'Title is missing' })
    const row = buildDeterministicFlagRow(flag, 5, new Map(), new Map())
    assert.equal(row.position, 5)
  })
})

// ── buildAiFlagRow ───────────────────────────────────────────────

function makeAi(partial: Partial<JudgeOutput['newFlags'][number]>): JudgeOutput['newFlags'][number] {
  return {
    rubric: 'MESSAGE',
    impactTag: 'CONVERSION',
    severity: 'IMPORTANT',
    problem: 'AI detected issue',
    evidence: 'AI spotted this problem',
    whyItMatters: 'This matters for conversion',
    fix: 'Fix it with AI',
    confidence: 0.85,
    ...partial,
  }
}

describe('buildAiFlagRow', () => {
  it('maps basic AI flag fields correctly', () => {
    const flag = makeAi({ rubric: 'EXPERIENCE', severity: 'CRITICAL' })
    const row = buildAiFlagRow(flag, 0, new Map(), new Map(), 0)

    assert.equal(row.source, 'AI')
    assert.equal(row.rubric, 'EXPERIENCE')
    assert.equal(row.severity, 'CRITICAL')
    assert.equal(row.checkId, null)
    assert.equal(row.position, 0)
  })

  it('maps severity through aiSeverityToEnum', () => {
    const flag = makeAi({ severity: 'HIGH' as never })
    const row = buildAiFlagRow(flag, 0, new Map(), new Map(), 0)
    assert.equal(row.severity, 'IMPORTANT')
  })

  it('maps impactTag through aiImpactToEnum', () => {
    const flag = makeAi({ impactTag: 'TRUST' })
    const row = buildAiFlagRow(flag, 0, new Map(), new Map(), 0)
    assert.equal(row.impactTag, 'TRUST')
  })

  it('falls back to null for unknown impactTag', () => {
    const flag = makeAi({ impactTag: 'PERFORMANCE' as JudgeOutput['newFlags'][number]['impactTag'] })
    const row = buildAiFlagRow(flag, 0, new Map(), new Map(), 0)
    assert.equal(row.impactTag, null)
  })

  it('uses whyItMatters from AI when present', () => {
    const flag = makeAi({ whyItMatters: 'AI provides custom impact' })
    const row = buildAiFlagRow(flag, 0, new Map(), new Map(), 0)
    assert.equal(row.whyItMatters, 'AI provides custom impact')
  })

  it('falls back whyItMatters to evidence when AI does not provide it', () => {
    const flag = makeAi({ whyItMatters: undefined } as unknown as JudgeOutput['newFlags'][number])
    const row = buildAiFlagRow(flag, 0, new Map(), new Map(), 0)
    assert.equal(row.whyItMatters, flag.evidence)
  })

  it('sets default verificationRule when AI does not provide one', () => {
    const flag = makeAi({ verificationRule: undefined })
    const row = buildAiFlagRow(flag, 0, new Map(), new Map(), 0)
    assert.equal(row.verificationRule, 'Confirm the issue described in evidence on the live page.')
  })

  it('uses AI verificationRule when provided', () => {
    const flag = makeAi({ verificationRule: 'Check manually on the live page' })
    const row = buildAiFlagRow(flag, 0, new Map(), new Map(), 0)
    assert.equal(row.verificationRule, 'Check manually on the live page')
  })

  it('positions AI flags after all deterministic flags', () => {
    const flag = makeAi({})
    const row = buildAiFlagRow(flag, 0, new Map(), new Map(), 5)
    assert.equal(row.position, 5)
  })

  it('resolves rubricId from rubric name map', () => {
    const flag = makeAi({ rubric: 'MESSAGE' })
    const rMap = rubricMap([['MESSAGE', 'rubric-message-id']])
    const row = buildAiFlagRow(flag, 0, new Map(), rMap, 0)
    assert.equal(row.rubricId, 'rubric-message-id')
  })
})
