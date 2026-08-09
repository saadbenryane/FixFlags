import { describe, expect, it, vi } from 'vitest'
import type { CanvasDocument, CanvasEvidenceBundle } from '@/lib/canvas/domain'
import { generateGroundedCanvas } from '@/lib/canvas/generation'
import { CanvasValidationError, validateCanvasDocument } from '@/lib/canvas/validation'

const evidence: CanvasEvidenceBundle = {
  auditId: 'audit-1',
  projectId: 'project-1',
  references: [
    { id: 'audit:1', kind: 'audit', auditId: 'audit-1', entityId: 'audit-1' },
    { id: 'rubric:message', kind: 'rubric', auditId: 'audit-1', entityId: 'MESSAGE' },
    { id: 'flag:1', kind: 'flag', auditId: 'audit-1', entityId: 'flag-1' },
    { id: 'capture:before', kind: 'capture', auditId: 'audit-1', entityId: 'before' },
    { id: 'capture:after', kind: 'capture', auditId: 'audit-1', entityId: 'after' },
    { id: 'memory:job', kind: 'memory', auditId: 'audit-1', entityId: 'memory-1' },
  ],
  audit: { score: 72, title: 'Example report' },
  rubrics: [{ refId: 'rubric:message', rubric: 'MESSAGE', score: 70, status: 'NEEDS_ATTENTION' }],
  flags: [{
    refId: 'flag:1', id: 'flag-1', rank: 1, rubric: 'MESSAGE', severity: 'IMPORTANT',
    problem: 'The promise is unclear', evidence: 'The hero uses generic copy', whyItMatters: 'Visitors cannot orient quickly',
  }],
  captures: [
    { refId: 'capture:before', id: 'before', assetId: 'asset-before', label: 'Before', viewport: 'desktop', phase: 'before' },
    { refId: 'capture:after', id: 'after', assetId: 'asset-after', label: 'After', viewport: 'desktop', phase: 'after' },
  ],
  memory: [{ refId: 'memory:job', id: 'memory-1', label: 'Primary job', value: 'Understand release readiness' }],
}

const valid: CanvasDocument = {
  schemaVersion: 1,
  title: 'Release readiness',
  blocks: [
    { id: 'score', type: 'score-summary', sourceRefIds: ['audit:1'], score: 72, label: 'Release score' },
    { id: 'flags', type: 'ranked-flags', sourceRefIds: ['flag:1'], title: 'What to fix', flagIds: ['flag-1'] },
    { id: 'compare', type: 'before-after', sourceRefIds: ['capture:before', 'capture:after'], title: 'Change', beforeCaptureRefId: 'capture:before', afterCaptureRefId: 'capture:after', summary: 'The revised promise is specific.' },
  ],
}

describe('validateCanvasDocument', () => {
  it('accepts a strict, evidence-grounded document', () => {
    expect(validateCanvasDocument(valid, evidence)).toEqual(valid)
  })

  it('rejects unknown fields and unsupported block types', () => {
    expect(() => validateCanvasDocument({ ...valid, css: 'body {}' }, evidence)).toThrow(CanvasValidationError)
    expect(() => validateCanvasDocument({ ...valid, blocks: [{ id: 'x', type: 'html', html: '<b>x</b>', sourceRefIds: [] }] }, evidence)).toThrow(CanvasValidationError)
  })

  it.each(['<script>alert(1)</script>', 'javascript:alert(1)', 'https://tracker.example/pixel', 'url(//tracker.example)'])(
    'rejects executable or remote content: %s',
    (text) => {
      expect(() => validateCanvasDocument({ ...valid, title: text }, evidence)).toThrow('executable or remote content')
    }
  )

  it('rejects missing, wrong-kind, and cross-audit evidence', () => {
    expect(() => validateCanvasDocument({ ...valid, blocks: [{ ...valid.blocks[0], sourceRefIds: ['flag:1'] }] }, evidence)).toThrow('invalid or inaccessible')
    expect(() => validateCanvasDocument({ ...valid, blocks: [{ ...valid.blocks[0], sourceRefIds: ['audit:missing'] }] }, evidence)).toThrow('invalid or inaccessible')
    expect(() => validateCanvasDocument(valid, {
      ...evidence,
      references: [{ ...evidence.references[0], auditId: 'audit-2' }, ...evidence.references.slice(1)],
    })).toThrow('crosses report boundaries')
  })

  it('rejects mislabeled before/after evidence', () => {
    expect(() => validateCanvasDocument(valid, {
      ...evidence,
      captures: evidence.captures.map((capture) => ({ ...capture, phase: 'observation' as const })),
    })).toThrow('invalid or inaccessible')
  })

  it('rejects quantitative claims that differ from the evidence bundle', () => {
    expect(() => validateCanvasDocument({
      ...valid,
      blocks: [{ ...valid.blocks[0], score: 99 }],
    }, evidence)).toThrow('invalid or inaccessible')
  })

  it('requires narrative claims to cite accessible evidence', () => {
    try {
      validateCanvasDocument({
        ...valid,
        blocks: [{ id: 'claim', type: 'text', sourceRefIds: [], text: 'The product is ready.' }],
      }, evidence)
      throw new Error('Expected Canvas validation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(CanvasValidationError)
      expect((error as CanvasValidationError).issues).toContain('claim must cite evidence')
    }
  })

  it('rejects internally inconsistent evidence bundles', () => {
    expect(() => validateCanvasDocument(valid, {
      ...evidence,
      flags: evidence.flags.map((flag) => ({ ...flag, id: 'different-flag' })),
    })).toThrow('internally inconsistent')
  })
})

describe('generateGroundedCanvas', () => {
  it('returns only evidence references actually used by the validated document', async () => {
    const usage = { model: 'canvas-model', inputTokens: 100, outputTokens: 40, cacheReadTokens: 20, cacheWriteTokens: 5 }
    const generator = { generate: vi.fn().mockResolvedValue({ output: valid, usage }) }
    const result = await generateGroundedCanvas({ generator, instruction: 'Summarize', evidence })
    expect(result.sourceRefs.map((reference) => reference.id)).toEqual([
      'audit:1', 'flag:1', 'capture:before', 'capture:after',
    ])
    expect(result.usage).toEqual(usage)
    expect(generator.generate).toHaveBeenCalledWith({ instruction: 'Summarize', evidence, previous: undefined })
  })

  it('does not return invalid provider output', async () => {
    const generator = { generate: vi.fn().mockResolvedValue({
      output: { ...valid, title: '<iframe />' },
      usage: { model: 'canvas-model', inputTokens: 100, outputTokens: 40, cacheReadTokens: 0, cacheWriteTokens: 0 },
    }) }
    await expect(generateGroundedCanvas({ generator, instruction: 'Summarize', evidence })).rejects.toThrow(CanvasValidationError)
  })
})
