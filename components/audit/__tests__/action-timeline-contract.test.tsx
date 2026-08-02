import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionTimeline } from '@/components/audit/ActionTimeline'
import { ProductContractCard } from '@/components/audit/ProductContractCard'
import React from 'react'

describe('ActionTimeline', () => {
  it('renders empty state', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionTimeline, { events: [] })
    )
    assert.match(html, /Review steps will appear/)
  })

  it('renders events', () => {
    const html = renderToStaticMarkup(
      React.createElement(ActionTimeline, {
        events: [
          { t: 1200, kind: 'navigate', label: 'Open homepage', url: 'https://example.com' },
          { t: 3400, kind: 'flow', label: 'CTA flow complete', status: 200 },
        ],
      })
    )
    assert.match(html, /Open homepage/)
    assert.match(html, /CTA flow complete/)
    assert.match(html, /1s/)
  })
})

describe('ProductContractCard', () => {
  it('renders purpose and outcomes', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProductContractCard, {
        contract: {
          purpose: 'Help founders check before they ship',
          firstValueJourney: 'Paste a URL and fix the top Flags',
          criticalOutcomes: ['Primary CTA works', 'Signup completes'],
          inferredAt: '2026-07-20T00:00:00.000Z',
          source: 'heuristic',
        },
      })
    )
    assert.match(html, /Help founders check before they ship/)
    assert.match(html, /First-value journey/)
    assert.match(html, /Primary CTA works/)
    assert.match(html, /inferred/)
  })

  it('shows edit control for owners', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProductContractCard, {
        contract: {
          purpose: 'Help founders check before they ship',
          firstValueJourney: 'Paste a URL and fix the top Flags',
          criticalOutcomes: ['Primary CTA works'],
          inferredAt: '2026-07-20T00:00:00.000Z',
          source: 'heuristic',
        },
        auditId: 'audit_123',
        canEdit: true,
      })
    )
    assert.match(html, /Edit/)
  })
})
