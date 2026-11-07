import { describe, expect, it } from 'vitest'
import { projectSiteActivity } from '../activity'
const input = { status: 'QUEUED', startedAt: null, failureCode: null, pages: [], events: [] }
describe('recorded Site activity', () => {
  it('never claims a queued job reached the website', () => {
    const activity = projectSiteActivity(input)
    expect(activity.label).toBe('Waiting to start')
    expect(activity.milestones.every((milestone) => milestone.state === 'pending')).toBe(true)
  })
  it('distinguishes never-started failure', () => {
    expect(projectSiteActivity({ ...input, status: 'FAILED' }).label).toBe('This check did not start')
  })
  it('does not infer completed optional work from a later stage', () => {
    const activity = projectSiteActivity({ ...input, status: 'JUDGING', startedAt: new Date(), pages: [{ status: 'FAILED' }] })
    expect(activity.pagesReached).toBe(0)
    expect(activity.milestones[2].state).toBe('pending')
  })
  it('uses durable method completion and strips raw event details', () => {
    const activity = projectSiteActivity({ ...input, status: 'JUDGING', startedAt: new Date('2026-10-07T11:00:00Z'), pages: [{ status: 'COMPLETED' }],
      events: [{ stage: 'checking', event: 'checks_completed', status: 'completed', occurredAt: new Date('2026-10-07T12:00:00Z') }] })
    expect(activity.pagesReached).toBe(1)
    expect(activity.milestones[2].state).toBe('done')
    expect(activity.events).toEqual([{ label: 'Check results recorded', at: '2026-10-07T12:00:00.000Z' }])
  })
  it('summarizes repeated page events without exposing prior attempts', () => {
    const activity = projectSiteActivity({ ...input, status: 'CHECKING', startedAt: new Date('2026-10-07T11:00:00Z'), events: [
      { stage: 'queued', status: 'failed', occurredAt: new Date('2026-10-07T10:00:00Z') },
      ...Array.from({ length: 24 }, (_, index) => ({ stage: 'checking', status: 'completed', occurredAt: new Date(`2026-10-07T12:00:${String(index).padStart(2, '0')}Z`) })),
    ] })
    expect(activity.events).toEqual([{ label: 'Check results recorded', at: '2026-10-07T12:00:23.000Z' }])
  })
  it('shows the saved check without an incomplete optional review milestone', () => {
    const activity = projectSiteActivity({ ...input, status: 'COMPLETED', failureCode: 'AI_CONTRACT_INVALID', events: [
      { stage: 'judging', event: 'triage_degraded_completed', status: 'partial', occurredAt: new Date() },
    ] })
    expect(activity.state).toBe('completed')
    expect(activity.milestones.map(milestone => milestone.label)).not.toContain('Reviewing findings')
    expect(activity.milestones.at(-1)).toMatchObject({ label: 'Saving results', state: 'done' })
    expect(activity.events).toEqual([])
  })
})
