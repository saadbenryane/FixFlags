import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUDIT_ERRORS } from '@/lib/marketing/copy'
import { siteCheckNotice, siteSummaryNotice } from '@/lib/sites/check-notice'
import { buildCoverageFacts } from '@/lib/sites/coverage'
import { siteCardHealth } from '@/lib/sites/site-health'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

const root = resolve(__dirname, '../../..')

describe('site check notice', () => {
  it('tells the customer a failed check did not finish and can be retried', () => {
    expect(siteCheckNotice({ status: 'FAILED', failureCode: 'SITE_UNREACHABLE' })).toEqual({
      title: AUDIT_ERRORS.checkFailedTitle,
      body: AUDIT_ERRORS.unreachable,
      retry: true,
    })
    expect(siteCheckNotice({ status: 'FAILED', failureCode: 'AUDIT_JOB_LOST' })).toEqual({
      title: 'Check failed',
      body: AUDIT_ERRORS.scannerUnavailable,
      retry: true,
    })
    expect(siteCheckNotice({ status: 'FAILED', failureCode: null })?.body).toBe(AUDIT_ERRORS.generic)
  })

  it('does not describe queued or completed work as a failed check', () => {
    expect(siteCheckNotice({ status: 'QUEUED', failureCode: null })).toBeNull()
    expect(siteCheckNotice({ status: 'CHECKING', failureCode: null })).toBeNull()
    expect(siteCheckNotice({ status: 'COMPLETED', failureCode: 'AI_PROVIDER_NOT_CONFIGURED' })).toBeNull()
    expect(siteCheckNotice({ status: null, failureCode: null })).toBeNull()
  })

  it('says the written summary was skipped without calling the check a failure', () => {
    const provider = siteSummaryNotice({ status: 'COMPLETED', failureCode: 'AI_PROVIDER_NOT_CONFIGURED' })
    expect(provider?.body).toBe('The written summary did not run. The Flags below come from the browser check.')
    expect(provider?.body).not.toMatch(/scanner|provider key|deterministic|Sign up/i)
    expect(siteSummaryNotice({ status: 'COMPLETED', failureCode: 'AUDIT_TIMEOUT' })?.body).toBe(
      'The written summary ran out of time. The Flags below come from the browser check.'
    )
    expect(siteSummaryNotice({ status: 'COMPLETED', failureCode: 'AUDIT_PIPELINE_FAILED' })?.body).toBe(
      'The written summary did not finish. The Flags below come from the browser check.'
    )
    expect(siteSummaryNotice({ status: 'FAILED', failureCode: 'AI_PROVIDER_NOT_CONFIGURED' })).toBeNull()
    expect(siteSummaryNotice({ status: 'COMPLETED', failureCode: 'SITE_UNREACHABLE' })).toBeNull()
    expect(siteSummaryNotice({ status: 'COMPLETED', failureCode: null })).toBeNull()
  })

  it('does not call a failed check with no flags a first look', () => {
    const coverage = buildCoverageFacts({
      auditStatus: 'FAILED',
      completedAt: null,
      evidenceCoverage: null,
      flags: [],
      rubrics: [],
    })
    const health = siteCardHealth({
      inFlight: false,
      finished: false,
      hasLastKnown: false,
      flags: [],
      coverage,
    })
    expect(coverage.every((fact) => fact.label === 'Couldn’t verify')).toBe(true)
    expect(health.state).toBe('unknown')
    expect(health.statusLabel).toBe('Couldn’t verify')
    expect(health.answer).toBe('This check did not finish')
    expect(health.answer).not.toMatch(/learning/i)
  })

  it('keeps an open Flag ahead of the failed-check label', () => {
    const health = siteCardHealth({
      inFlight: false,
      finished: false,
      hasLastKnown: false,
      flags: [{ severity: 'IMPORTANT' }],
      coverage: [],
    })
    expect(health.statusLabel).toBe(SITE_BOARD_COPY.flagStatus)
    expect(health.answer).toBe('1 Flag')
  })

  it('runs stuck-check recovery when the Site home is loaded', () => {
    const queries = readFileSync(resolve(root, 'lib/sites/application/queries.ts'), 'utf8')
    const board = readFileSync(resolve(root, 'components/sites/SiteBoard.tsx'), 'utf8')
    expect(queries).toContain('recoverAuditJobOnPoll')
    expect(queries).toContain('failureCode: audit?.failureCode ?? null')
    expect(board).toContain('siteCheckNotice')
    expect(board).toContain('/api/reports/${view.audit.id}/retry')
  })
})
