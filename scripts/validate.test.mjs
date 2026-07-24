import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertRepositoryUnchanged,
  buildPlan,
  isGeneratedPath,
  normalizeRepositoryState,
} from './validate.mjs'

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
      assert.ok(plan.commands.some((command) => command.label === 'container:build'))
    })

    it('builds the image when container packaging changes', () => {
      const plan = buildPlan('affected', ['Dockerfile'])
      assert.ok(plan.commands.some((command) => command.label === 'container:build'))
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
      assert.ok(labels.includes('image:local-patterns-guard'))
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
      assert.ok(labels.includes('image:local-patterns-guard'))
      assert.ok(labels.includes('product:contract-guard'))
      assert.ok(labels.includes('seo:guard'))
      assert.ok(labels.includes('completeness:audit'))
      assert.ok(labels.includes('test:scripts'))
      assert.ok(labels.includes('db:drift'))
      assert.ok(labels.includes('build'))
      assert.ok(labels.includes('worker:build'))
      assert.deepEqual(plan.commands.find((item) => item.label === 'build'), {
        label: 'build',
        executable: 'node',
        args: ['scripts/next-build.mjs'],
      })
      assert.ok(labels.includes('security:audit'))
    })

    it('keeps the validation harness in the full gate so side effects are guarded', () => {
      const plan = buildPlan('affected', ['scripts/validate.mjs'])
      assert.equal(plan.reason, 'shared validation config changed; using full validation')
    })

    it('release mode extends full validation with browser and container checks', () => {
      const labels = buildPlan('release', []).commands.map((command) => command.label)
      assert.ok(labels.includes('test:e2e'))
      assert.ok(labels.includes('container:build'))
      assert.ok(labels.includes('container:ready'))
      assert.ok(labels.includes('clean-install'))
      assert.ok(labels.includes('fresh-database'))
      assert.ok(labels.includes('deployed-smoke'))
      assert.ok(labels.includes('test:unit'))
    })

    it('ignores generated build and test artifacts', () => {
      for (const file of [
        '.next/server/app.js',
        '.next-e2e/types/app.ts',
        '.cache/eslint/result',
        'coverage/index.html',
        'fixflags-cli/dist/index.js',
        'playwright-report/index.html',
        'test-results/result.json',
      ]) {
        assert.equal(isGeneratedPath(file), true, file)
      }
      assert.equal(isGeneratedPath('app/report/[id]/page.tsx'), false)
    })

    it('drops generated paths before planning affected validation', () => {
      const plan = buildPlan('affected', ['.next-e2e/types/app.ts'])
      assert.equal(plan.commands.length, 0)
      assert.equal(plan.reason, 'no changed files detected')
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

  describe('repository side-effect guard', () => {
    it('normalizes porcelain state and ignores generated artifact paths', () => {
      const normalized = normalizeRepositoryState([
        ' M lib/audit/runner.ts',
        '?? .next-verify/types/app.ts',
        '?? coverage/index.html',
        ' M scripts/validate.mjs',
      ].join('\n'))
      assert.equal(
        normalized,
        [' M lib/audit/runner.ts', ' M scripts/validate.mjs'].join('\n'),
      )
    })

    it('allows identical repository state', () => {
      assert.doesNotThrow(() => {
        assertRepositoryUnchanged(
          ' M lib/audit/runner.ts\n',
          ' M lib/audit/runner.ts\n',
          'typecheck',
        )
      })
    })

    it('fails when a validation command edits source files', () => {
      assert.throws(
        () => assertRepositoryUnchanged(
          ' M lib/audit/runner.ts\n',
          ' M lib/audit/runner.ts\n M scripts/validate.mjs\n',
          'typecheck',
        ),
        /Validation command "typecheck" modified project files/,
      )
    })

    it('ignores generated-only changes when comparing repository state', () => {
      assert.doesNotThrow(() => {
        assertRepositoryUnchanged(
          ' M lib/audit/runner.ts\n',
          ' M lib/audit/runner.ts\n?? .next-verify/types/app.ts\n',
          'build',
        )
      })
    })
  })
})
