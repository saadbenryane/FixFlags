import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildSiteRepairBrief, buildSiteRepairHandoff } from '../repair-brief'
import { deliverSiteRepairBrief } from '../repair-delivery'
import { repairBriefDeliverySchema, repairBriefSchema } from '../repair-brief-contract'
import { MAX_REPAIR_BRIEF_BYTES, MAX_REPAIR_PROMPT_BYTES } from '../repair-budgets'
import { repairFlag, repairObservations } from './fixtures/repair-brief'

describe('bounded repair evidence delivery', () => {
  const build = (flag = repairFlag()) => buildSiteRepairBrief('site', flag, 'https://fixflags.test')
  const large = 'é🧭\\"\n'.repeat(40_000)
  it.each([
    ['large evidence', repairFlag({ evidence: large })],
    ['large guidance fields', repairFlag({ fix: large, whyItMatters: large, verificationRule: large })],
    ['many affected paths', repairFlag({ affectedPaths: Array.from({ length: 5000 }, (_, i) => `https://example.com/${i}/${'page'.repeat(20)}`) })],
    ['large supporting observations', repairFlag({ supportingObservations: repairObservations(2, large) })],
    ['large observation references', repairFlag({ supportingObservations: [{ ...repairObservations(1)[0], references: [{ selector: large, label: large, device: 'mobile' }] }] })],
  ])('reconstructs every supported large field and every observation without truncation: %s', (_fields, flag) => {
    const expectedObservations = flag.supportingObservations ?? []
    const received = []
    let observationOffset = 0
    let finished = false
    while (!finished) {
      const brief = buildSiteRepairBrief('site', flag, 'https://fixflags.test', 'original', observationOffset)
      let delivery = deliverSiteRepairBrief(brief)
      expect(delivery.schemaVersion).toBe('fixflags.repair-brief-fragment.v1')
      const pieces: string[] = []
      while (delivery.schemaVersion === 'fixflags.repair-brief-fragment.v1') {
        expect(repairBriefDeliverySchema.safeParse(delivery).success).toBe(true)
        expect(Buffer.byteLength(JSON.stringify(delivery))).toBeLessThanOrEqual(MAX_REPAIR_BRIEF_BYTES)
        expect(Buffer.byteLength(pieces.join(''))).toBe(delivery.document.offset)
        expect(Buffer.byteLength(delivery.document.text)).toBe(delivery.document.returnedBytes)
        expect(delivery.document.text).not.toContain('\uFFFD')
        pieces.push(delivery.document.text)
        if (delivery.document.nextOffset === null) {
          const json = pieces.join('')
          expect(Buffer.byteLength(json)).toBe(delivery.document.totalBytes)
          expect(createHash('sha256').update(json).digest('hex')).toBe(delivery.document.sha256)
          expect(repairBriefSchema.parse(JSON.parse(json))).toEqual(brief)
          expect(delivery.retrieval.next).toEqual(brief.retrieval.next)
          expect(delivery.links.next).toBe(brief.links.next)
          break
        }
        const args = delivery.retrieval.next!.arguments
        const query = new URL(delivery.links.next!).searchParams
        expect(Number(query.get('documentOffset'))).toBe(args.documentOffset)
        expect(query.get('documentHash')).toBe(args.expectedDocumentHash)
        const next = buildSiteRepairBrief(args.siteId, flag, 'https://fixflags.test', args.flagId, args.observationOffset, args.expectedContextHash)
        delivery = deliverSiteRepairBrief(next, args)
      }
      received.push(...brief.flag.supportingObservations ?? [])
      finished = brief.observationPage.nextOffset === null
      observationOffset = brief.observationPage.nextOffset ?? 0
    }
    expect(received).toEqual(expectedObservations)
    const task = buildSiteRepairHandoff('site', flag, 'https://fixflags.test')
    expect(task.prompt).toContain('complete repair JSON before any website change')
    expect(task.bundlePrompt).toContain('document.sha256')
    expect(Buffer.byteLength(task.prompt!)).toBeLessThanOrEqual(MAX_REPAIR_PROMPT_BYTES)
    expect(task.brief.contextHash).toBe(build(flag).contextHash)
    expect(task.promptHash).toBe(createHash('sha256').update(task.prompt!).digest('hex'))
  })
  it('preserves the existing inline contract for ordinary tasks', () => {
    const brief = build()
    expect(deliverSiteRepairBrief(brief)).toBe(brief)
    expect(buildSiteRepairHandoff('site', repairFlag(), 'https://fixflags.test').prompt).toContain(brief.repair.guidance)
  })
  it('refuses stale documents, unpinned offsets and offsets inside UTF-8 characters', () => {
    const brief = build(repairFlag({ evidence: large }))
    const first = deliverSiteRepairBrief(brief)
    if (first.schemaVersion !== 'fixflags.repair-brief-fragment.v1') throw new Error('Expected fragments')
    const args = first.retrieval.next!.arguments
    expect(() => deliverSiteRepairBrief(brief, { documentOffset: args.documentOffset }))
      .toThrow(expect.objectContaining({ status: 400, code: 'INVALID_REPAIR_DOCUMENT_PAGE' }))
    expect(() => deliverSiteRepairBrief(brief, { ...args, documentOffset: first.document.totalBytes }))
      .toThrow(expect.objectContaining({ status: 400 }))
    const json = Buffer.from(JSON.stringify(brief))
    const insideCharacter = json.indexOf(Buffer.from('🧭')) + 1
    expect(() => deliverSiteRepairBrief(brief, { ...args, documentOffset: insideCharacter }))
      .toThrow(expect.objectContaining({ status: 400 }))
    // Workflow is not a new repair revision, but mixing its serialized pages
    // would corrupt the document. Its separate transport digest fences that.
    const active = { ...brief, flag: { ...brief.flag, status: 'READY_TO_VERIFY' } }
    expect(active.contextHash).toBe(brief.contextHash)
    expect(() => deliverSiteRepairBrief(active, args))
      .toThrow(expect.objectContaining({ status: 409, code: 'REPAIR_DOCUMENT_CHANGED' }))
  })
})
