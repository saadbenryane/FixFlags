import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  attestRailwayDeployment,
  attestLocalFoundation,
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
  it('requires complete exact-candidate local foundation proof without manufacturing CI', () => {
    const foundation = { schemaVersion: 2, stage: 'foundation', profile: 'free-launch', status: 'PASS', gitSha: SHA, runId: 'proof-1',
      startedAt: '2026-08-25T19:00:00.000Z', completedAt: checks[0].completed_at,
      containerImageDigest: 'sha256:' + 'b'.repeat(64),
      commands: ['clean-install', 'fresh-database', 'full-verification', 'container-build', 'container-ready'].map(label => ({ label, exitCode: 0 })) }
    assert.equal(attestLocalFoundation(foundation, SHA).source, 'local-foundation')
    for (const invalid of [{ ...foundation, gitSha: 'c'.repeat(40) }, { ...foundation, status: 'FAIL' },
      { ...foundation, commands: foundation.commands.slice(1) }, { ...foundation, completedAt: 'invalid' },
      { ...foundation, commands: foundation.commands.map(command => ({ ...command, exitCode: 1 })) }])
      assert.throws(() => attestLocalFoundation(invalid, SHA))
    const evidence = buildDeploymentAttestation({ gitSha: SHA, repository: 'saadbenryane/FixFlags', localFoundation: foundation,
      deploymentsByRole: { web: { service: 'web', deployments: [deployment] }, worker: { service: 'worker', deployments: [deployment] } } })
    assert.equal(evidence.schemaVersion, 3)
    assert.equal(evidence.ci, undefined)
    assert.equal(evidence.verification.source, 'local-foundation')
    assert.throws(() => buildDeploymentAttestation({ gitSha: SHA, repository: 'saadbenryane/FixFlags', localFoundation: foundation,
      deploymentsByRole: { web: { service: 'web', deployments: [{ ...deployment, updatedAt: foundation.startedAt }] }, worker: { service: 'worker', deployments: [deployment] } } }), /post-verification/)
  })
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
