import test from 'node:test'
import assert from 'node:assert/strict'
import { uiStyleFailures } from './ui-style-rules.mjs'

test('retains display typography on brand and editorial surfaces', () => {
  const heading = '<h1 className="font-display text-4xl">Heading</h1>'
  for (const file of [
    'app/(marketing)/pricing/page.tsx',
    'app/(docs)/docs/not-found.tsx',
    'components/docs/DocsMarkdown.tsx',
    'components/knowledge/KnowledgePageHeader.tsx',
    'components/brand/Logo.tsx',
  ]) assert.deepEqual(uiStyleFailures(file, heading), [], file)
  assert.match(uiStyleFailures('components/sites/SiteBoard.tsx', heading)[0], /font-display outside/)
})

test('flat board panels and glass surfaces use their own semantic radii', () => {
  assert.deepEqual(uiStyleFailures('components/sites/SiteExecutionProgress.tsx',
    '<section className="rounded-board-panel border border-border p-4" />'), [])
  assert.deepEqual(uiStyleFailures('components/ui/card.tsx',
    '<div className="rounded-card glass-surface shadow-card" />'), [])
  assert.match(uiStyleFailures('components/sites/Panel.tsx',
    '<section className="rounded-xl border border-border p-4" />')[0], /surface radius token/)
})

test('continues rejecting arbitrary micro sizes in product components', () => {
  assert.match(uiStyleFailures('components/sites/Panel.tsx',
    '<span className="text-[11px]">Status</span>')[0], /arbitrary micro font size/)
})
