import { describe, expect, it } from 'vitest'
import { groundTriageTextFlags, reconcileLaunchChecklist } from '@/lib/audit/validate-triage-output'
import type { DeterministicFlag } from '@/lib/audit/flag-types'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'

const checklist: TriageOutput['launchChecklist'] = [
  { id: 'https', label: 'HTTPS', passed: false },
  { id: 'social-preview', label: 'Social preview', passed: false },
  { id: 'mobile-cta', label: 'Mobile CTA', passed: false },
  { id: 'console-errors', label: 'Console errors', passed: false },
  { id: 'privacy-contact', label: 'Privacy and contact', passed: true },
]

function flag(checkId: string): DeterministicFlag {
  return {
    checkId,
    rubric: 'REACH',
    severity: 'POLISH',
    problem: checkId,
    evidence: checkId,
    fix: checkId,
    confidence: 1,
    source: 'DETERMINISTIC',
  }
}

describe('reconcileLaunchChecklist', () => {
  it('uses deterministic pass/fail truth instead of AI checklist guesses', () => {
    const reconciled = reconcileLaunchChecklist(checklist, [
      flag('no-privacy-policy'),
    ])
    const passed = Object.fromEntries(reconciled.map((item) => [item.id, item.passed]))

    expect(passed).toEqual({
      https: true,
      'social-preview': true,
      'mobile-cta': true,
      'console-errors': true,
      'privacy-contact': false,
    })
  })
})


describe('groundTriageTextFlags', () => {
  const context = {
    pageText: 'Product teams use DemoSite to run releases. “Cut failed releases by 30%” - Sarah Chen, CTO at Acme.',
    metadata: { title: 'DemoSite release checklists', description: 'Release planning for product teams',
      h1s: ['Ship every release without a last-minute scramble'], ctaTexts: ['Start free'], hasStructuredData: true },
  }
  function candidate(problem: string, evidence: string, rubric: 'MESSAGE' | 'REACH' | 'EXPERIENCE' = 'MESSAGE'): TriageOutput['newFlags'][number] {
    return { problem, evidence, rubric, severity: 'IMPORTANT', confidence: 0.9,
      whyItMatters: 'Specific observed consequence' }
  }

  it('rejects the unsupported audience and testimonial claims from the live repaired demo', () => {
    expect(groundTriageTextFlags([
      candidate('Headline lacks specific audience signal', 'The headline does not indicate who specifically should use the product or their specific needs.'),
      candidate('Social proof lacks credibility', 'The testimonial is generic and lacks specifics such as names of projects or quantifiable results.'),
    ], context)).toEqual([])
  })

  it('rejects invented excerpts and ungrounded metadata judgments', () => {
    expect(groundTriageTextFlags([
      candidate('Copy promises unsupported guarantees', 'The page says "Guaranteed to double your revenue".'),
      candidate('Meta description lacks credibility', 'No credibility indicators appear in the description.', 'REACH'),
    ], context)).toEqual([])
  })

  it('derives bounded Recommendations from declared references instead of adopting their raw diagnosis', () => {
    const flags: TriageOutput['newFlags'] = [
      { ...candidate('Visitors abandon the trial', 'Unsupported behavioral claim'), reviewKind: 'action-clarity',
        evidenceRefs: [{ source: 'ctaText', quote: 'Start free' }], device: 'none' },
      { ...candidate('Description harms rankings', 'Unmeasured ranking claim', 'REACH'), reviewKind: 'search-snippet',
        evidenceRefs: [{ source: 'description', quote: 'Release planning for product teams' }], device: 'none' },
    ]
    const admitted = groundTriageTextFlags(flags, context)
    expect(admitted).toHaveLength(2)
    expect(admitted.every(flag => flag.problem.startsWith('Review'))).toBe(true)
    expect(admitted[0]!.evidence).toContain('"Start free"')
    expect(admitted[0]!.whyItMatters).toContain('were not measured')
    expect(admitted[1]!.whyItMatters).toContain('were not measured')
    expect(admitted.map(flag => flag.problem).join(' ')).not.toMatch(/abandon|harms rankings/)
  })

  it('requires exact matching quotes in their declared source and rejects unreferenced visual claims', () => {
    const valid = { ...candidate('Copy review', 'Model interpretation'), reviewKind: 'copy-clarity' as const,
      evidenceRefs: [{ source: 'pageText' as const, quote: 'Product teams use DemoSite' }], device: 'none' as const }
    expect(groundTriageTextFlags([valid], context)).toHaveLength(1)
    expect(groundTriageTextFlags([{ ...valid, evidenceRefs: [{ source: 'pageText', quote: 'Product teams   use DemoSite' }] },
      { ...valid, evidenceRefs: [{ source: 'title', quote: 'Product teams use DemoSite' }] },
      candidate('Hero overlaps form', 'A mobile screenshot proves a blocked field', 'EXPERIENCE')], context)).toEqual([])
  })
})
