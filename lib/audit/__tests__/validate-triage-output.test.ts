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
    pageText: 'Product teams use DemoSite to run releases. “Cut failed releases by 30%” — Sarah Chen, CTO at Acme.',
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

  it('retains source-backed content judgments and screenshot observations', () => {
    const flags = [
      candidate('Trial commitment is unclear', 'The CTA "Start free" does not explain when payment begins.'),
      candidate('Description repeats the category', 'Description: “Release planning for product teams”.', 'REACH'),
      candidate('Hero overlaps the form', 'The hero image covers the email field in the mobile screenshot.', 'EXPERIENCE'),
    ]
    expect(groundTriageTextFlags(flags, context)).toEqual(flags)
  })

  it('matches whitespace and straight or curly apostrophes while rejecting blank visual evidence', () => {
    expect(groundTriageTextFlags([
      candidate('Copy repeats', 'The text says "Product teams   use DemoSite".'),
      candidate('Layout is unclear', '  ', 'EXPERIENCE'),
    ], context)).toHaveLength(1)
  })
})
