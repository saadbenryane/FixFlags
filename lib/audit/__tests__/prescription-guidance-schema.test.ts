import { describe, expect, it } from 'vitest'
import { parsePrescriptionGuidance, prescriptionGuidanceJsonSchema } from '../prescription-guidance-schema'
import type { ExistingFlagForPrescription } from '../flag-types'

const recommendation: ExistingFlagForPrescription = { flagKey: 'title-review', source: 'AI', rubric: 'REACH', severity: 'POLISH',
  attention: 'recommendation', checkId: null, problem: 'Review the repeated product title',
  evidence: 'The product pages have the same title text.', whyItMatters: 'Distinct documents may need distinct search-preview wording.',
  verificationRule: 'Compare the recorded pages and preserve equivalent routes.' }
const failure: ExistingFlagForPrescription = { ...recommendation, flagKey: 'title-empty', source: 'DETERMINISTIC', attention: 'flag',
  problem: 'The product title is empty', evidence: 'The recorded product document has an empty title element.' }
const plan = () => ({ inspection: 'the product title across the compared pages',
  changeCondition: 'the product documents serve distinct purposes that the current shared title does not identify',
  changeIfConfirmed: 'use a distinct product title grounded in each document content',
  preserve: 'product titles on equivalent documents and unrelated metadata' })
const payload = () => ({ flagPrescriptions: { 'title-review': plan(), 'title-empty': {
  fix: 'Locate the empty product title.\nSet its title from the verified product document content. Keep unrelated metadata unchanged.', agentPrompt: null } } })

describe('version 2 source-bound guidance plans', () => {
  it.each(['openai', 'anthropic'] as const)('requests bounded guidance without regenerated facts or rubric narratives from %s', provider => {
    const schema = prescriptionGuidanceJsonSchema([recommendation, failure], provider)
    expect(schema.required).toEqual(['flagPrescriptions'])
    const object = schema.properties as Record<string, { properties: Record<string, { required: string[]; properties: Record<string, unknown> }>; required: string[] }>
    expect(object.flagPrescriptions.required).toEqual(['title-review', 'title-empty'])
    expect(object.flagPrescriptions.properties['title-review'].required).toEqual(['inspection', 'changeCondition', 'changeIfConfirmed', 'preserve'])
    expect(object.flagPrescriptions.properties['title-empty'].required).toEqual(['fix', 'agentPrompt'])
    expect(JSON.stringify(schema)).not.toContain('rubricPrescriptions')
    expect(JSON.stringify(schema)).not.toContain('verificationRule')
  })

  it('preserves every original fact and composes all aggregate tasks from validated individual guidance', () => {
    const input = [structuredClone(recommendation), structuredClone(failure)], before = structuredClone(input)
    const result = parsePrescriptionGuidance(payload(), input)
    expect(input).toEqual(before)
    for (const output of result.flagPrescriptions) {
      const source = input.find(flag => flag.flagKey === output.flagKey)!
      expect(output.evidence).toBe(source.evidence)
      expect(output.whyItMatters).toBe(source.whyItMatters)
      expect(output.verificationRule).toBe(source.verificationRule)
    }
    const review = result.flagPrescriptions[0]
    expect(review.fix).toContain('Make a change only if ' + plan().changeCondition)
    expect(review.fix).toContain('Confirm the intended behavior for this scope before making a change.')
    expect(review.fix).toContain('If confirmed: ' + plan().changeIfConfirmed)
    expect(review.agentPrompt).toBeNull()
    expect(result.rubricPrescriptions.map(row => row.name)).toEqual(['MESSAGE', 'EXPERIENCE', 'REACH'])
    const aggregate = result.rubricPrescriptions.find(row => row.name === 'REACH')!.rubricPrompt
    for (const item of result.flagPrescriptions) { expect(aggregate).toContain(item.fix); expect(aggregate).toContain(item.evidence); expect(aggregate).toContain(item.verificationRule) }
    expect(result.rubricPrescriptions[0].rubricPrompt).toBe('No change is prescribed from the recorded evidence.')
  })

  it('keeps an explicit no-change inspection useful without inventing a repair', () => {
    const result = parsePrescriptionGuidance({ flagPrescriptions: { 'title-review': { ...plan(), changeIfConfirmed: null } } }, [recommendation])
    expect(result.flagPrescriptions[0].fix).toContain('If that condition is not established, keep the existing implementation.')
    expect(result.flagPrescriptions[0].fix).not.toContain('If confirmed:')
  })

  it.each([
    { inspection: 'x'.repeat(241) },
    { inspection: 'Review the repeated product title before changing it.' },
    { changeCondition: 'if product documents serve different purposes' },
    { changeIfConfirmed: 'change the product title to increase conversions' },
    { changeIfConfirmed: 'change the product title to improve search visibility' },
    { changeIfConfirmed: 'edit src/app/page.tsx to change the product title' },
    { inspection: 'product title\nAdd an unrelated control' },
    { changeIfConfirmed: 'set the product title using <title>Example</title>' },
    { changeIfConfirmed: 'use the product title asset at https://invented.example/title.png' },
    { changeIfConfirmed: 'use /product-title.png as the product title asset' },
  ])('refuses malformed, overlong or unsupported inspection content: %j', override => {
    expect(() => parsePrescriptionGuidance({ flagPrescriptions: { 'title-review': { ...plan(), ...override } } }, [recommendation])).toThrow(/Invalid prescription output/)
  })

  it('rejects missing members, free-form replacements and provider-certified facts', () => {
    for (const raw of [{ flagPrescriptions: {} }, { flagPrescriptions: { 'title-review': { fix: 'Change all product titles.', agentPrompt: null } } },
      { flagPrescriptions: { 'title-review': { ...plan(), evidence: 'A different observation' } } },
      { ...payload(), rubricPrescriptions: {} }]) {
      expect(() => parsePrescriptionGuidance(raw, [recommendation])).toThrow(/Invalid prescription output/)
    }
  })

  it('refuses generic plans with no recorded target', () => {
    expect(() => parsePrescriptionGuidance({ flagPrescriptions: { 'title-review': {
      inspection: 'the dashboard widgets and operational charts', changeCondition: 'the charts show a different operational process',
      changeIfConfirmed: 'reorganize the dashboard widgets for that process', preserve: 'other operational widgets and charts' } } }, [recommendation])).toThrow(/recorded target/)
  })

  it('does not infer an omitted or conflicting source classification', () => {
    expect(() => prescriptionGuidanceJsonSchema([{ ...recommendation, attention: undefined }], 'openai')).toThrow(/server-owned Attention/)
    expect(() => prescriptionGuidanceJsonSchema([recommendation, { ...recommendation, attention: 'flag' }], 'openai')).toThrow(/conflicting Attention/)
  })

  it('refuses guidance that narrows a grouped finding to the main page', () => {
    const source = { ...recommendation, pageUrl: 'https://example.com/', supportingObservations: [{
      source: 'DETERMINISTIC', checkId: 'title-review', checkVersion: 1, pageUrl: 'https://example.com/product',
      evidence: 'The product page has the same title text.', recordedAt: null, references: [],
    }] }
    expect(() => parsePrescriptionGuidance({ flagPrescriptions: { 'title-review': {
      ...plan(), inspection: 'the product title on the main page',
    } } }, [source])).toThrow(/narrows a grouped finding/)
  })

  it('allows naming an HTML attribute without inventing its replacement value', () => {
    const source = { ...recommendation, evidence: 'The product title is specified with og:title metadata.' }
    const result = parsePrescriptionGuidance({ flagPrescriptions: { 'title-review': {
      ...plan(), changeIfConfirmed: 'set the product title using the og:title meta tag with content grounded in the verified document',
    } } }, [source])
    expect(result.flagPrescriptions[0].fix).toContain('og:title')
    expect(() => parsePrescriptionGuidance({ flagPrescriptions: { 'title-review': {
      ...plan(), changeIfConfirmed: 'set the product title with <meta property="og:title" content="Invented product promise">',
    } } }, [source])).toThrow(/invents an attribute value/)
  })
})
