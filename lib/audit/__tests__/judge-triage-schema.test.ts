import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  QUALITY_TRIAGE_SCHEMA,
  QUALITY_TRIAGE_SCHEMA_OPENAI,
  triageOutputSchema,
} from '@/lib/audit/judge-triage-schema'
import { normalizeTriageRawOutput } from '@/lib/audit/judge-triage'

interface SchemaIssue {
  path: string
  issue: string
}

function collectOpenAIStrictSchemaIssues(
  node: unknown,
  path = '$',
  issues: SchemaIssue[] = []
): SchemaIssue[] {
  if (Array.isArray(node)) {
    node.forEach((item, index) =>
      collectOpenAIStrictSchemaIssues(item, `${path}[${index}]`, issues)
    )
    return issues
  }
  if (!node || typeof node !== 'object') return issues

  const record = node as Record<string, unknown>
  if ('nullable' in record) issues.push({ path, issue: 'uses OpenAPI nullable keyword' })
  if ('format' in record) issues.push({ path, issue: 'uses unsupported format keyword' })

  if (record.type === 'object') {
    if (record.additionalProperties !== false) {
      issues.push({ path, issue: 'missing additionalProperties: false' })
    }

    const properties = record.properties as Record<string, unknown> | undefined
    if (properties) {
      const propertyKeys = Object.keys(properties).sort()
      const requiredKeys = Array.isArray(record.required)
        ? record.required.map(String).sort()
        : []
      if (JSON.stringify(propertyKeys) !== JSON.stringify(requiredKeys)) {
        issues.push({
          path,
          issue: `required keys do not match properties: properties=${propertyKeys.join(',')} required=${requiredKeys.join(',')}`,
        })
      }
    }
  }

  for (const [key, value] of Object.entries(record)) {
    collectOpenAIStrictSchemaIssues(value, `${path}.${key}`, issues)
  }
  return issues
}

describe('triageOutputSchema', () => {
  it('accepts nullable pageUrl on triage-only AI flags', () => {
    const parsed = triageOutputSchema.parse({
      pageJob: 'Explain what the product does and drive a signup.',
      pageType: 'landing',
      verdict: 'The page has the basics, but the next action is unclear. Fix the CTA hierarchy first.',
      score: 72,
      launchReadiness: 'fix_first',
      launchChecklist: [
        { id: 'https', label: 'HTTPS enabled', passed: true },
        { id: 'social-preview', label: 'Social preview ready', passed: true },
        { id: 'mobile-cta', label: 'Mobile CTA visible', passed: false },
        { id: 'console-errors', label: 'No console errors', passed: true },
        { id: 'privacy-contact', label: 'Privacy and contact present', passed: false },
      ],
      rubrics: [
        {
          name: 'MESSAGE',
          score: 75,
          grade: 'C',
          status: 'NEEDS_WORK',
          assessmentState: 'ASSESSED',
          confidence: 0.8,
          summary: 'The page explains the offer, but the audience and outcome could be sharper.',
        },
      ],
      newFlags: [
        {
          rubric: 'MESSAGE',
          impactTag: 'CLARITY',
          severity: 'IMPORTANT',
          problem: 'Hero copy does not make the primary user outcome concrete',
          confidence: 0.82,
          pageUrl: null,
        },
      ],
    })

    assert.equal(parsed.newFlags[0].pageUrl, null)
  })

  it('keeps Anthropic schema on OpenAPI nullable while OpenAI schema uses strict JSON Schema', () => {
    assert.match(JSON.stringify(QUALITY_TRIAGE_SCHEMA), /"nullable":true/)

    const issues = collectOpenAIStrictSchemaIssues(QUALITY_TRIAGE_SCHEMA_OPENAI)
    assert.deepEqual(issues, [])
  })

  it('normalizes missing and incomplete rubrics before contract validation', () => {
    const normalized = triageOutputSchema.parse(
      normalizeTriageRawOutput({
        pageJob: 'Explain a generic example domain.',
        pageType: 'other',
        verdict:
          'The page is intentionally minimal. The missing next step is the main issue.',
        score: 25,
        launchReadiness: 'fix_first',
        launchChecklist: [
          { id: 'https', label: 'HTTPS enabled', passed: true },
          { id: 'social-preview', label: 'Social preview ready', passed: false },
          { id: 'mobile-cta', label: 'Mobile CTA visible', passed: false },
          { id: 'console-errors', label: 'No console errors', passed: true },
          { id: 'privacy-contact', label: 'Privacy and contact present', passed: false },
        ],
        rubrics: [
          {
            name: 'MESSAGE',
            score: 25,
            grade: 'F',
            status: 'CRITICAL',
            assessmentState: 'ASSESSED',
            confidence: 0.8,
            summary: 'The page states what it is, but it has no product message.',
          },
          {
            name: 'EXPERIENCE',
            score: 60,
            grade: 'C',
            status: 'NEEDS_WORK',
            assessmentState: 'PARTIAL',
            confidence: 0.4,
            summary: 'The page is readable, but the available evidence is incomplete.',
          },
        ],
        newFlags: [
          {
            rubric: 'MESSAGE',
            impactTag: 'CLARITY',
            severity: 'IMPORTANT',
            problem: 'The page gives visitors no next step',
            confidence: 0.9,
            pageUrl: null,
          },
        ],
      })
    )

    assert.equal(normalized.rubrics.length, 3)
    assert.equal(normalized.rubrics.find((rubric) => rubric.name === 'EXPERIENCE')?.score, null)
    assert.equal(
      normalized.rubrics.find((rubric) => rubric.name === 'REACH')?.assessmentState,
      'UNKNOWN'
    )
  })
})
