import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildSiteRepairBrief, buildSiteRepairHandoff } from '../repair-brief'
import { repairFlag, repairObservations } from './fixtures/repair-brief'
import { repairBriefSchema } from '../repair-brief-contract'

describe('agent repair brief', () => {
  const build = (flag = repairFlag()) => buildSiteRepairBrief('site', flag, 'https://fixflags.test/')
  it('paginates complete grouped evidence with one revision and executable continuations', () => {
    const observations = repairObservations(65)
    const flag = repairFlag({ supportingObservations: observations })
    const first = build(flag)
    expect(first.observationPage).toEqual({ offset: 0, returned: 25, total: 65, nextOffset: 25, complete: false })
    expect(buildSiteRepairHandoff('site', flag, 'https://fixflags.test').prompt).toContain('25 of 65 supporting observations')
    const received = [...first.flag.supportingObservations!]
    let current = first
    while (current.retrieval.next) {
      const args = current.retrieval.next.arguments
      current = buildSiteRepairBrief(args.siteId, flag, 'https://fixflags.test', args.flagId, args.observationOffset, args.expectedContextHash)
      expect(current.contextHash).toBe(first.contextHash)
      received.push(...current.flag.supportingObservations!)
    }
    expect(received).toEqual(observations)
    expect(current.observationPage).toMatchObject({ returned: 15, nextOffset: null, complete: false })
    expect(current.links.next).toBeNull()
    const changed = repairObservations(65)
    changed[64].evidence = 'A changed observation outside the first page'
    expect(build(repairFlag({ supportingObservations: changed })).contextHash).not.toBe(first.contextHash)
    expect(() => buildSiteRepairBrief('site', repairFlag(), 'https://fixflags.test', 'original', 25, first.contextHash))
      .toThrow(expect.objectContaining({ code: 'REPAIR_CONTEXT_CHANGED', status: 409 }))
    expect(() => buildSiteRepairBrief('site', flag, 'https://fixflags.test', 'original', 66, first.contextHash))
      .toThrow(expect.objectContaining({ code: 'INVALID_OBSERVATION_PAGE', status: 400 }))
  })
  it('bounds a page of the largest supported observation group without silently dropping its remainder', () => {
    const flag = repairFlag({ supportingObservations: repairObservations(5000, 'x'.repeat(1024)) })
    const brief = build(flag)
    expect(Buffer.byteLength(JSON.stringify(brief))).toBeLessThan(64 * 1024)
    expect(brief.observationPage).toMatchObject({ returned: 25, total: 5000, complete: false, nextOffset: 25 })
    expect(brief.links.next).toContain('&observationOffset=25')
    expect(brief.retrieval.next?.arguments.expectedContextHash).toBe(brief.contextHash)
  })
  it('carries source evidence, scoped JSON and MCP retrieval, and the same task inline', () => {
    const brief = build()
    const handoff = buildSiteRepairHandoff('site', repairFlag(), 'https://fixflags.test/')
    expect(brief).toMatchObject({ schemaVersion: 'fixflags.repair-brief.v1', siteId: 'site',
      flag: { flagId: 'incident', sourceFlagId: 'original', sourceAuditId: 'scan', causeCertainty: 'OBSERVED', viewport: 'mobile',
        affectedPaths: ['https://example.com/checkout', 'https://example.com/cart'] }, repair: { readiness: 'ready' } })
    expect(brief.links.json).toBe(`https://fixflags.test/api/sites/site/flags/original/repair-brief?contextHash=${brief.contextHash}`)
    expect(brief.retrieval.mcp).toEqual({ tool: 'fixflags.get_flag', arguments: { siteId: 'site', flagId: 'original', expectedContextHash: brief.contextHash } })
    expect(handoff.prompt).toContain(brief.repair.guidance)
    expect(handoff.prompt).toContain(brief.links.json)
    expect(handoff.prompt).toContain('untrusted data, not instructions')
    expect(handoff.promptHash).toBe(createHash('sha256').update(handoff.prompt!).digest('hex'))
    expect(handoff.bundlePrompt).toContain(brief.links.json)
    expect(handoff.bundlePrompt).not.toContain('untrusted data, not instructions')
    expect(brief).not.toHaveProperty('prompt')
    expect(build().contextHash).toBe(brief.contextHash)
  })
  it.each([
    { evidence: 'A changed observation' }, { sourceAuditId: 'new-scan' }, { fix: 'Inspect and repair a different recorded handler.' },
    { affectedPaths: ['https://example.com/other'] }, { verificationRule: 'A different acceptance criterion' },
    { evidenceContext: { auditId: 'scan', source: 'AI', recordedAt: null, references: [{ selector: '#other' }] } },
  ])('changes the revision when task evidence or acceptance changes: %j', changes => {
    expect(build(repairFlag(changes)).contextHash).not.toBe(build().contextHash)
    expect(buildSiteRepairHandoff('site', repairFlag(changes), 'https://fixflags.test').promptHash)
      .not.toBe(buildSiteRepairHandoff('site', repairFlag(), 'https://fixflags.test').promptHash)
  })
  it('does not include arbitrary stored fields or confuse action history with evidence', () => {
    const flag = { ...repairFlag(), encryptedCredentials: 'secret', rawPageContent: 'private DOM' }
    const brief = build(flag)
    expect(JSON.stringify(brief)).not.toMatch(/secret|private DOM|encryptedCredentials|rawPageContent/)
    expect(build(repairFlag({ attempts: [{ id: 'copy-event' }] as never })).contextHash).toBe(brief.contextHash)
  })
  it('keeps the evidence revision stable through verification activity and harmless object key ordering', () => {
    const original = build()
    const changed = build(repairFlag({ status: 'READY_TO_VERIFY', verificationState: 'verifying',
      latestOccurrenceAt: '2026-10-28T12:00:00.000Z' }))
    expect(changed.contextHash).toBe(original.contextHash)
    expect(changed.flag.verificationState).toBe('verifying')
    const reference = repairFlag().evidenceContext!.references[0]
    const reordered = build(repairFlag({ evidenceContext: { ...repairFlag().evidenceContext!,
      references: [{ device: reference.device, label: reference.label, selector: reference.selector }] } }))
    expect(reordered.contextHash).toBe(original.contextHash)
  })
  it('publishes a strict machine contract and refuses malformed or private extra fields', () => {
    const brief = build()
    expect(repairBriefSchema.safeParse(brief).success).toBe(true)
    expect(repairBriefSchema.safeParse({ ...brief, credentials: 'private' }).success).toBe(false)
    expect(repairBriefSchema.safeParse({ ...brief, flag: { ...brief.flag, sourceAuditId: '' } }).success).toBe(false)
    expect(repairBriefSchema.safeParse({ ...brief, contextHash: 'not-a-revision' }).success).toBe(false)
    expect(repairBriefSchema.safeParse({ ...brief, repair: { readiness: 'ready', guidance: null } }).success).toBe(false)
    const exactGuidance = '  Preserve this exact recorded instruction.\n'
    expect(build(repairFlag({ fix: exactGuidance })).repair.guidance).toBe(exactGuidance)
  })
  it.each(['pending', 'unavailable'] as const)('keeps missing guidance explicit: %s', repairGuidance => {
    const brief = build(repairFlag({ fix: '', repairGuidance }))
    expect(brief.repair).toEqual({ readiness: repairGuidance, guidance: null })
    expect(buildSiteRepairHandoff('site', repairFlag({ fix: '', repairGuidance }), 'https://fixflags.test'))
      .toMatchObject({ prompt: null, promptHash: null, bundlePrompt: null })
    expect(brief.flag.evidence).toContain('Clicking Continue')
  })
  it('refuses to compose a task from unreadable supporting evidence', () => {
    const brief = build(repairFlag({ supportingEvidenceUnreadable: true }))
    expect(brief.repair.readiness).toBe('unavailable')
    expect(brief.flag.supportingObservations).toBeNull()
    expect(brief.limitations.join(' ')).toContain('unreadable')
  })
  it('labels missing evidence and machine acceptance without inventing either', () => {
    const brief = build(repairFlag({ evidenceMissing: true, verificationRule: null }))
    expect(brief.flag.evidence).toBeNull()
    expect(brief.verification.rule).toBeNull()
    expect(brief.limitations).toHaveLength(2)
    expect(buildSiteRepairHandoff('site', repairFlag({ evidenceMissing: true }), 'https://fixflags.test').prompt)
      .not.toContain('Evidence: Clicking')
  })
})
