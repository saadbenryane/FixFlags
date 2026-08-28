import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  QUALITY_PRESCRIPTION_SCHEMA_OPENAI,
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

describe('QUALITY_PRESCRIPTION_SCHEMA_OPENAI strict mode', () => {
  it('lists every flagPrescription property in required (OpenAI strict)', () => {
    const hits = collectRequired(QUALITY_PRESCRIPTION_SCHEMA_OPENAI)
    const flagItem = hits.find((h) => h.path.includes('flagPrescriptions') && h.path.includes('items'))
    assert.ok(flagItem, 'expected flagPrescriptions items required array')
    for (const key of [
      'flagKey',
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
