import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { buildSampleDashboardPreview } from '@/lib/marketing/sample-dashboard-preview'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'

describe('buildSampleDashboardPreview', () => {
  const report = buildSampleReportDisplay(getStaticSampleAudit())

  it('projects real sample host, score, and flag counts without inventing Flags', () => {
    const preview = buildSampleDashboardPreview(report)

    assert.equal(preview.host, report.displayHost)
    assert.equal(preview.score, report.score)
    assert.equal(preview.flagCount, report.flagCount)
    assert.equal(
      preview.rubricCounts.message +
        preview.rubricCounts.experience +
        preview.rubricCounts.reach,
      report.flagCount
    )
    assert.ok(preview.issues.every((issue) => report.flags.some((f) => f.id === issue.id)))
    assert.ok(!preview.issues.some((issue) => /https enabled/i.test(issue.title)))
  })

  it('caps issue rows and selects the first real Flag for the detail panel', () => {
    const preview = buildSampleDashboardPreview(report, { issueCap: 3 })
    assert.ok(preview.issues.length <= 3)
    assert.ok(preview.selected)
    assert.equal(preview.selected!.title, report.flags[0]!.title)
    assert.match(preview.selected!.severityLabel, /Flag/i)
    assert.ok(!/apply fix/i.test(preview.selected!.fixPrompt))
  })

  it('exposes real rubric scores instead of a synthetic trend series', () => {
    const preview = buildSampleDashboardPreview(report)
    assert.equal(preview.rubricScores.length, report.rubricScores.length)
    for (const row of preview.rubricScores) {
      const source = report.rubricScores.find((r) => r.name === row.name)
      assert.ok(source)
      assert.equal(row.score, source!.score)
    }
  })

  it('never invents Flag ids beyond the sample report', () => {
    const preview = buildSampleDashboardPreview(report)
    const ids = new Set(report.flags.map((f) => f.id))
    for (const issue of preview.issues) {
      assert.ok(ids.has(issue.id), `Invented flag id: ${issue.id}`)
    }
  })
})
