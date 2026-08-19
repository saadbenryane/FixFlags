import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  attachEvidenceTargets,
  axeTargetsFromViolations,
  isPageScopeCheck,
  parseEvidenceTargets,
  rectFromViewport,
} from '@/lib/audit/evidence-targets'

describe('evidence-targets', () => {
  it('normalizes a viewport box to a top-left capture rect', () => {
    const rect = rectFromViewport({ left: 400, top: 300, right: 600, bottom: 360 }, 1280, 800)
    assert.ok(rect)
    assert.ok(rect.x < 400 / 1280)
    assert.ok(rect.y < 300 / 800)
    assert.ok(rect.width > 200 / 1280)
    assert.ok(rect.height > 60 / 800)
  })

  it('drops boxes that sit below the captured viewport', () => {
    assert.equal(
      rectFromViewport({ left: 10, top: 900, right: 200, bottom: 980 }, 1280, 800),
      null
    )
  })

  it('classifies metadata checks as page-scope', () => {
    assert.equal(isPageScopeCheck('description-missing'), true)
    assert.equal(isPageScopeCheck('h1-generic::page:1'), false)
  })

  it('attaches measured element targets from harvest, never a preset rect', () => {
    const flags = attachEvidenceTargets(
      [
        {
          checkId: 'h1-generic',
          problem: 'Headline is generic',
          evidence: 'Headline reads a category label.',
        },
      ],
      [
        {
          device: 'desktop',
          viewport: { width: 1280, height: 800 },
          nodes: [
            {
              key: 'h1',
              selector: 'h1',
              text: 'Welcome',
              rect: { x: 0.12, y: 0.18, width: 0.4, height: 0.08 },
            },
          ],
        },
      ]
    )
    assert.equal(flags[0]?.evidenceTargets?.length, 1)
    assert.equal(flags[0]?.evidenceTargets?.[0]?.kind, 'element')
    assert.equal(flags[0]?.evidenceTargets?.[0]?.source, 'measured')
    assert.deepEqual(flags[0]?.evidenceTargets?.[0]?.rect, {
      x: 0.12,
      y: 0.18,
      width: 0.4,
      height: 0.08,
    })
  })

  it('does not invent an element box when the harvest has no match', () => {
    const flags = attachEvidenceTargets(
      [{ checkId: 'h1-generic', problem: 'Headline is generic', evidence: 'No H1 measured.' }],
      [{ device: 'desktop', viewport: { width: 1280, height: 800 }, nodes: [] }]
    )
    assert.deepEqual(flags[0]?.evidenceTargets, [])
  })

  it('emits page targets without rects for metadata checks', () => {
    const flags = attachEvidenceTargets(
      [{ checkId: 'description-missing', problem: 'Missing description', evidence: 'No meta description.' }],
      [{ device: 'desktop', viewport: { width: 1280, height: 800 }, nodes: [] }]
    )
    assert.equal(flags[0]?.evidenceTargets?.[0]?.kind, 'page')
    assert.equal(flags[0]?.evidenceTargets?.[0]?.rect, undefined)
  })

  it('rejects guessed or malformed persisted targets', () => {
    assert.deepEqual(
      parseEvidenceTargets([
        { kind: 'element', source: 'preset', device: 'desktop', rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 } },
        { kind: 'element', source: 'measured', device: 'desktop', rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 } },
      ]),
      [
        {
          kind: 'element',
          source: 'measured',
          device: 'desktop',
          rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
          selector: undefined,
          label: 'Flagged area',
        },
      ]
    )
  })

  it('collects unique axe targets', () => {
    const targets = axeTargetsFromViolations([
      { nodes: [{ target: ['main', 'h1'] }, { target: ['main', 'h1'] }] },
      { nodes: [{ target: ['button.submit'] }] },
    ])
    assert.equal(targets.length, 2)
    assert.deepEqual(targets[0], ['main', 'h1'])
  })
})
