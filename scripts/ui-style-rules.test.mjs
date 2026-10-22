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

test('rejects grouping lines in component classes, email HTML and CSS', () => {
  for (const [file, source] of [
    ['components/live-support/SupportWidget.tsx', '<header className="border-b border-border p-4" />'],
    ['components/report/workspace-geometry.ts', "const chrome = 'border-r border-border px-3'"],
    ['components/uptime/UptimeCard.module.css', '.rows li { border-bottom: 1px solid currentColor; }'],
    ['lib/email/layout.ts', '<hr style="border-top:1px solid gray">'],
    ['components/marketing/Section.tsx', '<div className="divide-y divide-border" />'],
  ]) assert.match(uiStyleFailures(file, source).join('\n'), /line separator/, file)
})

test('retains control outlines, zero-width resets and functional chart or seek lines', () => {
  for (const source of [
    '<input className="border border-input" />',
    '<div className="border-2 border-t-transparent" />',
    '<div className="border-b-0" />',
    '<div className="h-px bg-border" />',
    '.control { border-top: 0; }',
  ]) assert.deepEqual(uiStyleFailures('components/ui/control.tsx', source), [])
})

test('preserves the evaluated third-party fixture without exempting product CSS', () => {
  const source = '.demo-header { border-bottom: 1px solid gray; }'
  assert.deepEqual(uiStyleFailures('app/demo/demo.css', source), [])
  assert.match(uiStyleFailures('components/docs/DocsExperience.module.css', source).join('\n'), /line separator/)
})
