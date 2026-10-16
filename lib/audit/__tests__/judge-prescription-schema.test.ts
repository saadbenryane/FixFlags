import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  prescriptionProviderJsonSchema,
  parsePrescriptionProviderOutput,
  flagPrescriptionSchema,
} from '@/lib/audit/judge-prescription-schema'

function collectRequired(node: unknown, path: string[] = []): Array<{ path: string; required: string[] }> {
  if (!node || typeof node !== 'object') return []
  const record = node as Record<string, unknown>
  const hits: Array<{ path: string; required: string[] }> = []
  if (Array.isArray(record.required)) {
    hits.push({ path: path.join('.') || 'root', required: record.required as string[] })
  }
  if (record.properties && typeof record.properties === 'object') {
    for (const [key, value] of Object.entries(record.properties as Record<string, unknown>)) {
      hits.push(...collectRequired(value, [...path, key]))
    }
  }
  if (record.items) hits.push(...collectRequired(record.items, [...path, 'items']))
  if (Array.isArray(record.anyOf)) {
    record.anyOf.forEach((branch, i) => {
      hits.push(...collectRequired(branch, [...path, `anyOf[${i}]`]))
    })
  }
  return hits
}

describe('prescription provider identity contract', () => {
  it.each(['openai', 'anthropic'] as const)('requires every exact admitted identity and payload field for %s', provider => {
    const keys = Array.from({ length: 12 }, (_, index) => `flag-${index}`)
    const schema = prescriptionProviderJsonSchema([...keys, keys[0]], provider)
    const hits = collectRequired(schema)
    const flagMap = hits.find(hit => hit.path === 'flagPrescriptions')!
    assert.deepEqual(flagMap.required, keys)
    const flagItem = hits.find((h) => h.path === 'flagPrescriptions.flag-0')!
    assert.ok(flagItem, 'expected keyed prescription payload')
    for (const key of [
      'evidence',
      'whyItMatters',
      'fix',
      'agentPrompt',
      'cursorPrompt',
      'claudePrompt',
      'windsurfPrompt',
      'lovablePrompt',
      'boltPrompt',
      'verificationRule',
    ]) {
      assert.ok(flagItem.required.includes(key), `missing required ${key}`)
    }
    assert.equal(flagItem.required.includes('flagKey'), false)
    const objects = schema.properties as Record<string, { additionalProperties: boolean }>
    assert.equal(objects.flagPrescriptions.additionalProperties, false)
    assert.deepEqual(hits.find(hit => hit.path === 'rubricPrescriptions')!.required, ['MESSAGE', 'EXPERIENCE', 'REACH'])
    assert.equal(objects.rubricPrescriptions.additionalProperties, false)
  })

  const payload = () => ({ evidence: 'The recorded button is hidden outside the mobile viewport.', whyItMatters: 'Visitors cannot continue to the cart.', fix: '1. Move the button into view.\n2. Keep its existing label.', agentPrompt: null, cursorPrompt: null, claudePrompt: null, windsurfPrompt: null, lovablePrompt: null, boltPrompt: null, verificationRule: 'Verify the button at the same viewport.' })
  const rubric = { rubricPrompt: 'Address the recorded findings.', cursorPrompt: null, claudePrompt: null, windsurfPrompt: null, lovablePrompt: null, boltPrompt: null }
  const rubrics = { MESSAGE: rubric, EXPERIENCE: rubric, REACH: rubric }

  it('preserves exact identities independently of provider property order and repeated occurrences', () => {
    const parsed = parsePrescriptionProviderOutput({ flagPrescriptions: { 'flag-b': payload(), 'flag-a': payload() }, rubricPrescriptions: rubrics }, ['flag-a', 'flag-b', 'flag-a'])
    assert.deepEqual(parsed.flagPrescriptions.map(item => item.flagKey), ['flag-a', 'flag-b'])
    assert.equal(parsed.flagPrescriptions[0].evidence, payload().evidence)
    assert.deepEqual(parsed.rubricPrescriptions.map(item => item.name), ['MESSAGE', 'EXPERIENCE', 'REACH'])
  })

  it('rejects absent, repeated-array and invented rubric identities at the provider boundary', () => {
    for (const rubricPrescriptions of [{ MESSAGE: rubric, EXPERIENCE: rubric }, [],
      [{ name: 'MESSAGE', ...rubric }, { name: 'MESSAGE', ...rubric }, { name: 'MESSAGE', ...rubric }],
      { ...rubrics, CONVERSION: rubric }]) {
      assert.throws(() => parsePrescriptionProviderOutput({ flagPrescriptions: {}, rubricPrescriptions }, []), /Invalid prescription output/)
    }
  })

  it('refuses missing, invented and nested replacement identities instead of fabricating prescriptions', () => {
    for (const flagPrescriptions of [{ 'flag-a': payload() }, { 'flag-a': payload(), 'flag-b': payload(), 'flag-c': payload() }, { 'flag-a': { ...payload(), flagKey: 'flag-z' }, 'flag-b': payload() }]) {
      assert.throws(() => parsePrescriptionProviderOutput({ flagPrescriptions, rubricPrescriptions: rubrics }, ['flag-a', 'flag-b']), /Invalid prescription output/)
    }
  })

  it('accepts a genuinely empty Flag set and rejects an empty admitted key', () => {
    assert.deepEqual(parsePrescriptionProviderOutput({ flagPrescriptions: {}, rubricPrescriptions: rubrics }, []).flagPrescriptions, [])
    assert.throws(() => prescriptionProviderJsonSchema([' '], 'openai'), /nonempty/)
  })

  it('accepts null agentPrompt in zod parse', () => {
    const parsed = flagPrescriptionSchema.parse({
      flagKey: 'title-missing',
      evidence: 'The browser tab shows Untitled instead of a product name that visitors can trust.',
      whyItMatters: 'Search and tabs without titles lose clicks before the page is even opened.',
      fix: '1. Set a descriptive <title>.\n2. Keep it under 60 characters.',
      agentPrompt: null,
      cursorPrompt: null,
      claudePrompt: null,
      windsurfPrompt: null,
      lovablePrompt: null,
      boltPrompt: null,
      verificationRule: 'Reload and check the browser tab title.',
    })
    assert.equal(parsed.agentPrompt, null)
  })
})
