import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { releaseStageCommands } from './release-receipts.mjs'
import {
  attestRailwayDeployment,
  attestLocalFoundation,
  attestSuccessfulChecks,
  buildDeploymentAttestation,
  loadRailwayCandidateDeployments,
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
  statusUpdatedAt: '2026-08-25T20:02:00.000Z',
  meta: { commitHash: SHA, imageDigest: 'sha256:' + 'd'.repeat(64) },
}

describe('release deployment attestation', () => {
  it('requires complete exact-candidate local foundation proof without manufacturing CI', () => {
    const foundation = { schemaVersion: 2, stage: 'foundation', profile: 'free-launch', status: 'PASS', gitSha: SHA, runId: 'proof-1',
      startedAt: '2026-08-25T19:00:00.000Z', completedAt: checks[0].completed_at,
      containerImageDigest: 'sha256:' + 'b'.repeat(64),
      previousGitSha: 'b'.repeat(40), artifacts: [{ label: 'upgrade-evidence', sha256: 'c'.repeat(64) }],
      commands: releaseStageCommands('foundation').map(([label]) => ({ label, exitCode: 0 })) }
    assert.equal(attestLocalFoundation(foundation, SHA).source, 'local-foundation')
    for (const invalid of [{ ...foundation, gitSha: 'c'.repeat(40) }, { ...foundation, status: 'FAIL' },
      { ...foundation, commands: foundation.commands.slice(1) }, { ...foundation, completedAt: 'invalid' },
      { ...foundation, commands: foundation.commands.filter(command => command.label !== 'progressive-execution') },
      { ...foundation, commands: foundation.commands.filter(command => command.label !== 'website-persistence') },
      { ...foundation, commands: foundation.commands.filter(command => command.label !== 'uptime-persistence') },
      { ...foundation, commands: foundation.commands.map(command => ({ ...command, exitCode: 1 })) }])
      assert.throws(() => attestLocalFoundation(invalid, SHA))
    const evidence = buildDeploymentAttestation({ gitSha: SHA, repository: 'saadbenryane/FixFlags', localFoundation: foundation,
      deploymentsByRole: { web: { service: 'web', deployments: [deployment] }, worker: { service: 'worker', deployments: [deployment] } } })
    assert.equal(evidence.schemaVersion, 3)
    assert.equal(evidence.ci, undefined)
    assert.equal(evidence.verification.source, 'local-foundation')
    assert.throws(() => buildDeploymentAttestation({ gitSha: SHA, repository: 'saadbenryane/FixFlags', localFoundation: foundation,
      deploymentsByRole: { web: { service: 'web', deployments: [{ ...deployment, statusUpdatedAt: foundation.startedAt }] }, worker: { service: 'worker', deployments: [deployment] } } }), /post-verification/)
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
      deployments: [{ ...deployment, statusUpdatedAt: '2026-08-25T19:59:30.000Z', updatedAt: '2026-08-25T20:03:00.000Z' }],
      service: 'QewOS',
      role: 'web',
      gitSha: SHA,
      ciCompletedAt: '2026-08-25T20:00:00.000Z',
    }), /post-CI/)
    assert.equal(attestRailwayDeployment({
      deployments: [
        { ...deployment, id: 'old', status: 'REMOVED', createdAt: '2026-08-25T19:58:00.000Z', statusUpdatedAt: '2026-08-25T20:04:00.000Z' },
        { ...deployment, id: 'new', createdAt: '2026-08-25T19:59:00.000Z', statusUpdatedAt: '2026-08-25T20:03:00.000Z' },
      ],
      service: 'QewOS',
      role: 'web',
      gitSha: SHA,
      ciCompletedAt: '2026-08-25T20:00:00.000Z',
    }).deploymentId, 'new')
  })

  it('never substitutes metadata updates or an unversioned image for transition proof', () => {
    const input = { service: 'web', role: 'web', gitSha: SHA, ciCompletedAt: checks[0].completed_at }
    assert.throws(() => attestRailwayDeployment({ ...input, deployments: [{ ...deployment,
      statusUpdatedAt: undefined, updatedAt: deployment.statusUpdatedAt }] }), /post-CI/)
    assert.throws(() => attestRailwayDeployment({ ...input, deployments: [deployment, { ...deployment, id: 'unknown', createdAt: undefined }] }), /incomplete deployment creation evidence/)
    for (const imageDigest of [null, 'latest', 'sha256:image'])
      assert.throws(() => attestRailwayDeployment({ ...input, deployments: [{ ...deployment,
        meta: { ...deployment.meta, imageDigest } }] }), /immutable image digest/)
  })

  it('reads exact candidate transitions through the current authenticated Railway API', () => {
    const calls = []
    const read = (executable, args) => {
      calls.push([executable, args])
      return args[0] === 'deployment' ? [deployment, { ...deployment, id: 'other', meta: { commitHash: 'b'.repeat(40) } }]
        : { data: { deployment } }
    }
    assert.deepEqual(loadRailwayCandidateDeployments({ service: 'web', environment: 'production', gitSha: SHA }, read), [deployment])
    assert.equal(calls.length, 2)
    assert.equal(calls[1][1][0], 'api')
    assert.ok(calls[1][1].includes('id=deployment-1'))
    for (const response of [{ errors: [{ message: 'Provider error' }], data: { deployment } },
      { data: { deployment: { ...deployment, id: 'foreign' } } },
      { data: { deployment: { ...deployment, meta: { commitHash: 'b'.repeat(40) } } } }])
      assert.throws(() => loadRailwayCandidateDeployments({ service: 'web', environment: 'production', gitSha: SHA },
        (_executable, args) => args[0] === 'deployment' ? [deployment] : response), /identity is invalid/)
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
