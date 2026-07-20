import { cases } from './cases.mjs'
import { config } from './config.mjs'

export async function runCase(caseId) {
  const caseDef = cases.find((c) => c.id === caseId)
  if (!caseDef) {
    throw new Error(`Case not found: ${caseId}`)
  }

  const start = Date.now()
  try {
    const result = await Promise.race([
      caseDef.run(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), config.timeout)
      ),
    ])
    const grade = caseDef.grade(result)
    const duration = Date.now() - start
    return { caseId, grade, result, duration, error: null }
  } catch (error) {
    const duration = Date.now() - start
    return { caseId, grade: 'fail', result: null, duration, error: error.message }
  }
}

export async function runAll() {
  const results = []
  for (const caseDef of cases) {
    const result = await runCase(caseDef.id)
    results.push(result)
  }
  return results
}
