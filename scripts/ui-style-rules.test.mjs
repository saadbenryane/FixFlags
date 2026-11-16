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
  assert.deepEqual(uiStyleFailures('components/sites/SiteActivityPanel.tsx',
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
    ['components/sites/workspace-geometry.ts', "const chrome = 'border-r border-border px-3'"],
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

test('shared shadows, pill radii and UI type sizes come from tokens', () => {
  assert.deepEqual(uiStyleFailures('components/marketing/Card.module.css',
    '.card { box-shadow: var(--shadow-paper); border-radius: var(--radius-pill); font-size: var(--text-caption); }'), [])
  assert.deepEqual(uiStyleFailures('components/marketing/Hero.module.css', '.title { font-size: 28px; }'), [])
  assert.match(uiStyleFailures('components/marketing/Card.module.css',
    '.card { box-shadow: 0 1px 2px hsl(30 10% 20% / .05); }').join('\n'), /hand-typed warm shadow/)
  assert.match(uiStyleFailures('components/layout/Switcher.tsx',
    '<span className="shadow-[0_1px_2px_hsl(30_10%_20%/.08)]" />').join('\n'), /hand-typed warm shadow/)
  assert.match(uiStyleFailures('components/marketing/Pill.module.css', '.pill { border-radius: 999px; }').join('\n'), /pill radius/)
  assert.match(uiStyleFailures('components/sites/Row.module.css', '.meta { font-size: 13px; }').join('\n'), /literal UI font size/)
  assert.deepEqual(uiStyleFailures('lib/design/tokens.css', '--shadow-chip: 0 1px 2px hsl(30 10% 20% / .06);'), [])
})
