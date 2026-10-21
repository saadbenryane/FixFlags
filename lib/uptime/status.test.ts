import { expect, it } from 'vitest'
import { projectUptimeStatus, uptimeAssessment } from './status'
import { siteCardHealth } from '@/lib/sites/site-health'
import { resultPresentation } from '@/lib/sites/presentation'
import type { CoverageFact } from '@/lib/sites/coverage'

const now = new Date('2026-10-20T12:00:00Z')
const project = { id: 'site', url: 'https://example.com/', deletedAt: null, watchInterval: 'WEEKLY' as const,
  watchNextRunAt: now, user: { id: 'owner', lifecycleStatus: 'ACTIVE' as const } }
const monitor = { targetUrl: project.url, version: 1, incidents: [], enabled: true, state: 'online', lastCheckedAt: now, nextProbeAt: now, confirmationDueAt: null }
const coverage: CoverageFact[] = [{ area: 'security', state: 'healthy', label: 'Recorded', detail: null, checkedAt: now.toISOString(), openFlagCount: 0, evidenced: true }]
const executionSpec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: project.url, environment: 'production', checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null }
const base = { inFlight: false, finished: true, hasLastKnown: true, flags: [], now, coverage, executionSpec }

it('retains an unresolved current incident as attention while current reachability is unknown', () => {
  const incident = { version: 1, targetUrl: project.url, confirmedAt: new Date(now.getTime() - 60_000) }
  for (const observation of [{ state: 'unknown', lastCheckedAt: now }, { state: 'offline', lastCheckedAt: new Date(now.getTime() - 11 * 60_000) }]) {
    const status = projectUptimeStatus(project, { ...monitor, ...observation, incidents: [incident] }, now)
    expect(status).toMatchObject({ state: 'unknown', incidentOpen: true })
    const health = siteCardHealth({ ...base, uptime: status })
    expect(health).toMatchObject({ state: 'problem', statusLabel: 'Needs attention', assessment: { result: 'FLAG', gaps: [{ area: 'uptime', reason: 'incomplete' }] } })
    expect(resultPresentation({ auditStatus: 'COMPLETED', healthState: health.state, flagCount: 0,
      stale: false, hasCurrentEvidence: true, uptime: health.uptime })).toEqual({ state: 'flags', label: 'Needs attention' })
    expect(health.uptime).toMatchObject({ state: 'FLAG', observedState: 'unknown', validUntil: null })
  }
})

it('never borrows an incident from another target, generation or future confirmation', () => {
  for (const incident of [
    { version: 0, targetUrl: project.url, confirmedAt: now },
    { version: 1, targetUrl: project.url + 'other', confirmedAt: now },
    { version: 1, targetUrl: project.url, confirmedAt: new Date(now.getTime() + 1000) },
  ]) {
    const status = projectUptimeStatus(project, { ...monitor, state: 'unknown', incidents: [incident] }, now)
    expect(uptimeAssessment(status, now)?.state).toBe('COULD_NOT_VERIFY')
  }
  const incident = { version: 1, targetUrl: project.url, confirmedAt: now }
  expect(uptimeAssessment(projectUptimeStatus({ ...project, url: project.url + 'new' },
    { ...monitor, incidents: [incident] }, now), now)?.state).toBe('COULD_NOT_VERIFY')
  expect(uptimeAssessment(projectUptimeStatus(project, { ...monitor, enabled: false, incidents: [incident] }, now), now)?.state)
    .toBe('FLAG')
  expect(uptimeAssessment(projectUptimeStatus({ ...project, watchInterval: null }, { ...monitor, incidents: [incident] }, now), now))
    .toBeNull()
})

it.each(['offline', 'online', 'checking', 'unknown'])('projects the same current %s state for summary consumers', state => {
  const status = projectUptimeStatus(project, { ...monitor, state }, now)
  expect(status.state).toBe(state)
  const assessed = uptimeAssessment(status, now)
  expect(assessed?.state).toBe(state === 'offline' ? 'FLAG' : state === 'online' ? 'CLEAR' : 'COULD_NOT_VERIFY')
  expect(assessed?.validUntil?.getTime()).toBe(now.getTime() + 10 * 60_000)
})

it('requires current-target evidence and preserves pauses and account lifecycle eligibility', () => {
  for (const old of [null, { ...monitor, targetUrl: 'https://old.example/' }, { ...monitor, enabled: false },
    { ...monitor, lastCheckedAt: new Date(now.getTime() - 11 * 60_000) }])
    expect(uptimeAssessment(projectUptimeStatus(project, old, now), now)?.state).toBe('COULD_NOT_VERIFY')
  for (const stopped of [{ ...project, watchInterval: null }, { ...project, deletedAt: now },
    { ...project, user: { ...project.user, lifecycleStatus: 'SUSPENDED' as const } }]) {
    const status = projectUptimeStatus(stopped, monitor, now)
    expect(status.state).toBe('paused')
    expect(uptimeAssessment(status, now)).toBeNull()
  }
  expect(uptimeAssessment({ enabled: true, state: 'online', lastCheckedAt: 'invalid' }, now)?.state).toBe('COULD_NOT_VERIFY')
})

it('keeps confirmed downtime visible during another analysis, without adding synthetic Flags', () => {
  const health = siteCardHealth({ ...base, inFlight: true, finished: false, hasLastKnown: false,
    uptime: projectUptimeStatus(project, { ...monitor, state: 'offline' }, now) })
  expect(health.state).toBe('problem')
  expect(resultPresentation({ auditStatus: 'CHECKING', healthState: health.state, flagCount: 0,
    stale: false, hasCurrentEvidence: false, uptime: health.uptime })).toEqual({ state: 'flags', label: 'Offline' })
})

it('withholds Clear for an uptime gap but does not erase another problem or certify its repair', () => {
  const unknown = projectUptimeStatus(project, null, now), online = projectUptimeStatus(project, monitor, now)
  expect(siteCardHealth({ ...base, uptime: unknown }).assessment).toMatchObject({ result: 'COULD_NOT_VERIFY', gaps: [{ area: 'uptime', reason: 'incomplete' }] })
  expect(siteCardHealth({ ...base, uptime: unknown, flags: [{ severity: 'IMPORTANT' }] }).assessment.result).toBe('FLAG')
  expect(siteCardHealth({ ...base, uptime: online, flags: [{ severity: 'IMPORTANT' }] }).assessment.result).toBe('FLAG')
  expect(siteCardHealth({ ...base, uptime: online }).assessment.result).toBe('CLEAR')
})
