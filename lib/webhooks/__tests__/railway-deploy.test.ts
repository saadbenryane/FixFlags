import { describe, it, expect } from 'vitest'
import {
  isRailwayDeploySuccessEvent,
  resolveRailwayCheckUrl,
} from '@/lib/webhooks/railway-deploy'

describe('railway-deploy webhook helpers', () => {
  it('accepts DEPLOY_SUCCESS and Deployment.success style events', () => {
    expect(isRailwayDeploySuccessEvent({ type: 'DEPLOY_SUCCESS' })).toBe(true)
    expect(isRailwayDeploySuccessEvent({ type: 'Deployment.success' })).toBe(true)
    expect(isRailwayDeploySuccessEvent({ type: 'DEPLOY_COMPLETED', deployment: { status: 'SUCCESS' } })).toBe(
      true
    )
  })

  it('rejects failures and in-progress events', () => {
    expect(isRailwayDeploySuccessEvent({ type: 'DEPLOY_FAILED' })).toBe(false)
    expect(isRailwayDeploySuccessEvent({ type: 'DEPLOY_STARTED' })).toBe(false)
    expect(isRailwayDeploySuccessEvent({ type: 'Deployment.failed' })).toBe(false)
  })

  it('prefers configured url over payload hints', () => {
    const url = resolveRailwayCheckUrl(
      { type: 'DEPLOY_SUCCESS', deployment: { url: 'https://from-payload.example' } },
      'https://configured.example'
    )
    expect(url).toBe('https://configured.example')
  })
})
