import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  attestRailwayDeployment,
  attestSuccessfulChecks,
  buildDeploymentAttestation,
} from './release-deployment-attestation.mjs'

const SHA = 'a'.repeat(40)
const checks = [{
  name: 'CI / verify',
  status: 'completed',
  conclusion: 'success',
  completed_at: '2026-08-25T20:00:00.000Z',
}]
const deployment = {
  id: 'deployment-1',
  status: 'SUCCESS',
  createdAt: '2026-08-25T19:59:00.000Z',
  updatedAt: '2026-08-25T20:02:00.000Z',
  meta: { commitHash: SHA, imageDigest: 'sha256:image' },
}

describe('release deployment attestation', () => {
  it('requires every GitHub check to complete successfully', () => {
    assert.equal(attestSuccessfulChecks(checks).status, 'SUCCESS')
    assert.throws(
      () => attestSuccessfulChecks([{ ...checks[0], conclusion: 'skipped' }]),
      /skipped, or failed/,
    )
  })

  it('requires an exact-SHA successful Railway transition after CI', () => {
    assert.equal(attestRailwayDeployment({
      deployments: [deployment],
      service: 'QewOS',
      role: 'web',
      gitSha: SHA,
      ciCompletedAt: '2026-08-25T20:00:00.000Z',
    }).gitSha, SHA)
    assert.throws(() => attestRailwayDeployment({
      deployments: [{ ...deployment, updatedAt: '2026-08-25T19:59:30.000Z' }],
      service: 'QewOS',
      role: 'web',
      gitSha: SHA,
      ciCompletedAt: '2026-08-25T20:00:00.000Z',
    }), /post-CI/)
    assert.equal(attestRailwayDeployment({
      deployments: [
        { ...deployment, id: 'old', status: 'FAILED', updatedAt: '2026-08-25T20:01:00.000Z' },
        { ...deployment, id: 'new', updatedAt: '2026-08-25T20:03:00.000Z' },
      ],
      service: 'QewOS',
      role: 'web',
      gitSha: SHA,
      ciCompletedAt: '2026-08-25T20:00:00.000Z',
    }).deploymentId, 'new')
  })

  it('requires exact web and worker evidence', () => {
    const evidence = buildDeploymentAttestation({
      gitSha: SHA,
      repository: 'saadbenryane/FixFlags',
      checkRuns: checks,
      deploymentsByRole: {
        web: { service: 'QewOS', deployments: [deployment] },
        worker: { service: 'FixFlags Worker', deployments: [{ ...deployment, id: 'deployment-2' }] },
      },
    })
    assert.equal(evidence.schemaVersion, 2)
    assert.deepEqual(evidence.services.map((service) => service.role), ['web', 'worker'])
  })
})
