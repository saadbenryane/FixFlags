export const config = {
  fixtureDir: 'scripts/agent-evals/fixtures',
  reportDir: 'scripts/agent-evals/reports',
  timeout: 30000,
  cases: [
    'repository-orientation',
    'docs-only-routing',
    'report-ui',
    'audit-pipeline',
    'prompt-contract',
    'billing-gates',
    'public-cli',
    'failure-recovery',
    'instruction-budget',
  ],
}
