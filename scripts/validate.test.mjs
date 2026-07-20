import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildPlan } from './validate.mjs'

describe('validate.mjs', () => {
  describe('buildPlan', () => {
    it('returns empty commands for no changed files', () => {
      const plan = buildPlan('quick', [])
      assert.equal(plan.commands.length, 0)
      assert.equal(plan.reason, 'no changed files detected')
    })

    it('returns empty commands for docs-only changes', () => {
      const plan = buildPlan('quick', ['README.md', 'docs/strategy.md', 'knowledge/product.md'])
      assert.equal(plan.commands.length, 0)
      assert.equal(plan.reason, 'docs-only changes detected')
    })

    it('runs full validation when package.json changes', () => {
      const plan = buildPlan('quick', ['package.json'])
      assert.ok(plan.commands.length > 5)
      assert.equal(plan.reason, 'shared validation config changed; using full validation')
    })

    it('runs full validation when prisma schema changes', () => {
      const plan = buildPlan('quick', ['prisma/schema.prisma'])
      assert.ok(plan.commands.length > 5)
      assert.equal(plan.reason, 'shared validation config changed; using full validation')
    })

    it('runs full validation when tsconfig changes', () => {
      const plan = buildPlan('quick', ['tsconfig.json'])
      assert.ok(plan.commands.length > 5)
    })

    it('quick mode lints changed files + typechecks', () => {
      const plan = buildPlan('quick', ['lib/audit/runner.ts'])
      const labels = plan.commands.map((c) => c.label)
      assert.ok(labels.includes('lint:changed'))
      assert.ok(labels.includes('typecheck'))
      assert.ok(!labels.some((l) => l.startsWith('test:')))
    })

    it('affected mode runs typecheck + lint + affected tests + guards', () => {
      const plan = buildPlan('affected', ['lib/audit/runner.ts'])
      const labels = plan.commands.map((c) => c.label)
      assert.ok(labels.includes('typecheck'))
      assert.ok(labels.includes('lint'))
      assert.ok(labels.some((l) => l.startsWith('test:')))
      assert.ok(labels.includes('brand:hex-guard'))
      assert.ok(labels.includes('ui:drift-guard'))
      assert.ok(labels.includes('seo:guard'))
    })

    it('affected mode runs audit tests for lib/audit/ changes', () => {
      const plan = buildPlan('affected', ['lib/audit/checks/metadata.ts'])
      const labels = plan.commands.map((c) => c.label)
      assert.ok(labels.includes('test:audit'))
    })

    it('affected mode runs billing tests for lib/billing/ changes', () => {
      const plan = buildPlan('affected', ['lib/billing/limits.ts'])
      const labels = plan.commands.map((c) => c.label)
      assert.ok(labels.includes('test:billing'))
    })

    it('affected mode runs queue tests for lib/queue/ changes', () => {
      const plan = buildPlan('affected', ['lib/queue/client.ts'])
      const labels = plan.commands.map((c) => c.label)
      assert.ok(labels.includes('test:queue'))
    })

    it('full mode runs all checks', () => {
      const plan = buildPlan('full', ['lib/audit/runner.ts'])
      const labels = plan.commands.map((c) => c.label)
      assert.ok(labels.includes('typecheck'))
      assert.ok(labels.includes('lint'))
      assert.ok(labels.includes('test:unit'))
      assert.ok(labels.includes('brand:hex-guard'))
      assert.ok(labels.includes('ui:drift-guard'))
      assert.ok(labels.includes('seo:guard'))
      assert.ok(labels.includes('build'))
      assert.ok(labels.includes('worker:build'))
    })

    it('lint-changed mode only lints changed TS files', () => {
      const plan = buildPlan('lint-changed', ['lib/audit/runner.ts', 'README.md'])
      const labels = plan.commands.map((c) => c.label)
      assert.ok(labels.includes('lint:changed'))
      assert.equal(labels.length, 1)
    })

    it('lint-changed mode returns empty for non-TS changes', () => {
      const plan = buildPlan('lint-changed', ['README.md', 'docs/strategy.md'])
      assert.equal(plan.commands.length, 0)
    })

    it('throws for unknown mode', () => {
      assert.throws(() => buildPlan('invalid', ['file.ts']), /Unknown validation mode/)
    })
  })
})
