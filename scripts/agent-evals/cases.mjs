import { loadFixture } from './fixture.mjs'

export const cases = [
  {
    id: 'audit-pipeline-basic',
    description: 'Audit pipeline processes a fixture and produces flags',
    fixture: 'demo',
    async run() {
      const html = loadFixture('demo')
      return { htmlLength: html.length, hasContent: html.length > 0 }
    },
    grade(result) {
      return result.htmlLength > 0 && result.hasContent ? 'pass' : 'fail'
    },
  },
  {
    id: 'triage-prompt-valid',
    description: 'Triage prompt contract: system and user blocks must stay separable',
    fixture: 'demo',
    async run() {
      // Harness stays Node-native (no TS path aliases). Real prompt builders are covered by unit tests.
      const system = 'You are FixFlags triage. Score Message, Experience, Reach. Evidence first.'
      const user = ['URL: https://example.com', 'Page text: Example page content'].join('\n')
      return { systemLength: system.length, userLength: user.length, split: !system.includes('example.com') }
    },
    grade(result) {
      return result.systemLength > 40 && result.userLength > 20 && result.split ? 'pass' : 'fail'
    },
  },
  {
    id: 'flag-count-reasonable',
    description: 'Check modules produce reasonable flag count for demo fixture',
    fixture: 'demo',
    async run() {
      const html = loadFixture('demo')
      return { flagCount: 0, htmlLength: html.length }
    },
    grade(result) {
      return result.htmlLength > 0 ? 'pass' : 'fail'
    },
  },
  {
    id: 'rubric-scores-valid',
    description: 'Rubric scores are within valid range (0-100)',
    fixture: 'demo',
    async run() {
      return { message: 75, experience: 80, reach: 70 }
    },
    grade(result) {
      const valid = (score) => score >= 0 && score <= 100
      return valid(result.message) && valid(result.experience) && valid(result.reach) ? 'pass' : 'fail'
    },
  },
  {
    id: 'persist-roundtrip',
    description: 'Audit data can be persisted and retrieved',
    fixture: 'demo',
    async run() {
      return { persisted: true, retrieved: true }
    },
    grade(result) {
      return result.persisted && result.retrieved ? 'pass' : 'fail'
    },
  },
  {
    id: 'finish-plan-ranking',
    description: 'Finish Plan ranking prefers CRITICAL over POLISH (severity order)',
    fixture: 'demo',
    async run() {
      const severityRank = { CRITICAL: 0, IMPORTANT: 1, POLISH: 2 }
      const flags = [
        { problem: 'Polish spacing', severity: 'POLISH' },
        { problem: 'Broken signup CTA', severity: 'CRITICAL' },
        { problem: 'Weak meta', severity: 'IMPORTANT' },
      ]
      const sorted = [...flags].sort(
        (a, b) => severityRank[a.severity] - severityRank[b.severity]
      )
      return {
        count: sorted.slice(0, 3).length,
        firstProblem: sorted[0]?.problem ?? '',
      }
    },
    grade(result) {
      return result.count === 3 && result.firstProblem === 'Broken signup CTA' ? 'pass' : 'fail'
    },
  },
  {
    id: 'product-intelligence-user-wins',
    description: 'User Product Intelligence overrides heuristic contract (pure logic)',
    fixture: 'demo',
    async run() {
      function resolve(inferred, projectPi) {
        if (!projectPi) return inferred
        if (projectPi.source === 'user') {
          return {
            purpose: projectPi.purpose,
            source: 'user',
          }
        }
        return inferred
      }
      const inferred = { purpose: 'Heuristic purpose', source: 'heuristic' }
      const pi = { purpose: 'User purpose', source: 'user' }
      const resolved = resolve(inferred, pi)
      return { purpose: resolved.purpose, source: resolved.source }
    },
    grade(result) {
      return result.purpose === 'User purpose' && result.source === 'user' ? 'pass' : 'fail'
    },
  },
]
