import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { buildPlan } from '../validate.mjs'

function command(executable, args, validate = () => true) {
  return () => {
    const result = spawnSync(executable, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout = result.stdout || ''
    const stderr = result.stderr || ''
    return {
      status: result.status,
      stdoutBytes: Buffer.byteLength(stdout),
      stderrBytes: Buffer.byteLength(stderr),
      valid: result.status === 0 && validate(stdout, stderr),
      failure: result.status === 0 ? null : `${stdout}\n${stderr}`.trim().split('\n').slice(-20).join('\n'),
    }
  }
}

function commandCase(id, description, executable, args, validate) {
  return {
    id,
    description,
    run: command(executable, args, validate),
    grade: (result) => result.valid ? 'pass' : 'fail',
  }
}

export const cases = [
  commandCase(
    'repository-orientation',
    'The live home view returns bounded structured repository state.',
    'node',
    ['scripts/project-agent.mjs', '--json'],
    (stdout) => {
      const payload = JSON.parse(stdout)
      return payload.project === 'qewos' && payload.state.changedFiles.total >= 0 && payload.recommendations.total > 0
    }
  ),
  {
    id: 'docs-only-routing',
    description: 'Documentation-only work avoids irrelevant code verification.',
    async run() {
      const plan = buildPlan('affected', ['docs/example.md', 'knowledge/product.md'])
      return { valid: plan.commands.length === 0, commandCount: plan.commands.length, reason: plan.reason }
    },
    grade: (result) => result.valid ? 'pass' : 'fail',
  },
  commandCase(
    'report-ui',
    'Real report UI tests preserve progressive and failure states.',
    'npx',
    ['vitest', 'run', 'components/audit/__tests__/AuditFailurePanel.test.tsx', 'components/audit/__tests__/AuditReportProgressive.test.tsx']
  ),
  commandCase(
    'audit-pipeline',
    'Real audit ranking and pipeline state tests pass.',
    'npx',
    ['vitest', 'run', 'lib/audit/__tests__/priority-flags.test.ts', 'lib/audit/__tests__/pipeline-state-machine.test.ts']
  ),
  commandCase(
    'prompt-contract',
    'Real prompt and judge configuration contracts pass.',
    'npx',
    ['vitest', 'run', 'lib/audit/__tests__/judge-contract.test.ts', 'lib/audit/__tests__/judge-config.test.ts']
  ),
  commandCase(
    'billing-gates',
    'Real billing plan and limit tests pass.',
    'npx',
    ['vitest', 'run', 'lib/billing/__tests__/plans.test.ts', 'lib/billing/__tests__/limits.test.ts']
  ),
  commandCase(
    'public-cli',
    'The built FixFlags CLI passes its HTTP contract and workflow tests.',
    'npm',
    ['--prefix', 'fixflags-cli', 'test']
  ),
  commandCase(
    'failure-recovery',
    'The agent façade handles invalid input, dry-run routing, and bounded output.',
    'node',
    ['--test', 'scripts/project-agent.test.mjs']
  ),
  {
    id: 'instruction-budget',
    description: 'Always-loaded root instructions stay below the pilot budget.',
    async run() {
      const bytes = Buffer.byteLength(readFileSync('AGENTS.md', 'utf8'))
      return { valid: bytes < 12_000, bytes }
    },
    grade: (result) => result.valid ? 'pass' : 'fail',
  },
]
