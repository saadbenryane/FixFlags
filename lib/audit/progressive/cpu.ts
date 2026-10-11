import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { BoundedSemaphore } from './capacity'
import { TaskFailure } from './contracts'
import { pageMetadataSchema } from './snapshots'
import { searchObservationSchema, type SearchPageEvidence, type SearchReceipt } from '../search/contracts'

const capacity = new BoundedSemaphore(1)
const DEV_BOOTSTRAP = 'require("tsx/cjs"); require(workerData.module);'

async function isolated(input: object, deadline: number): Promise<unknown> {
  return capacity.run(() => new Promise((resolve, reject) => {
    const production = process.env.NODE_ENV === 'production'
    const worker = production
      ? new Worker(path.join(process.cwd(), 'dist/worker/check-parser.js'), { workerData: { input }, resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16 } })
      : new Worker('const { workerData } = require("node:worker_threads"); ' + DEV_BOOTSTRAP, {
        eval: true, workerData: { module: path.join(process.cwd(), 'worker/check-parser.ts'), input },
        resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16 },
      })
    let settled = false
    const finish = (error: Error | null, value?: unknown) => {
      if (settled) return
      settled = true; clearTimeout(timer)
      // Termination is awaited before releasing parser capacity.
      void worker.terminate().finally(() => error ? reject(error) : resolve(value))
    }
    const timer = setTimeout(() => finish(new TaskFailure('PARSER_DEADLINE', true, undefined, true)), Math.max(1, Math.min(25_000, deadline - Date.now())))
    worker.once('message', value => finish(null, value))
    worker.once('error', () => finish(new TaskFailure('PARSER_CRASH', true, undefined, true)))
    worker.once('exit', code => { if (!settled) finish(new TaskFailure(code ? 'PARSER_CRASH' : 'PARSER_NO_RESULT', true, undefined, true)) })
  }), AbortSignal.timeout(Math.max(1, deadline - Date.now())))
}
export async function parseMetadataIsolated(html: string, url: string, deadline: number) {
  if (Buffer.byteLength(html) > 1_000_000) throw new TaskFailure('HTML_BODY_LIMIT', false)
  return pageMetadataSchema.parse(await isolated({ operation: 'metadata', html, url }, deadline))
}
export async function evaluateSearchIsolated(evidence: SearchPageEvidence, previous: SearchReceipt | null | undefined, deadline: number) {
  const observations = await isolated({ operation: 'search', evidence, previous }, deadline)
  return searchObservationSchema.array().parse(observations)
}
