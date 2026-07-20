export const config = {
  fixtureDir: 'scripts/agent-evals/fixtures',
  reportDir: 'scripts/agent-evals/reports',
  timeout: 30000,
  cases: [
    'audit-pipeline-basic',
    'triage-prompt-valid',
    'flag-count-reasonable',
    'rubric-scores-valid',
    'persist-roundtrip',
  ],
}
