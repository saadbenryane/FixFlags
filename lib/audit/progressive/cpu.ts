import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { BoundedSemaphore } from './capacity'
import { TaskFailure } from './contracts'
import { pageMetadataSchema } from './snapshots'
import { searchObservationSchema, type SearchPageEvidence, type SearchReceipt } from '../search/contracts'

const capacity = new BoundedSemaphore(1)
const DEV_BOOTSTRAP = 'require("tsx/cjs"); require(workerData.module);'
let parser: Worker | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null

function clearIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
}

function parserWorker() {
  clearIdleTimer()
  if (parser) return parser
  const production = process.env.NODE_ENV === 'production'
  const worker = production
    ? new Worker(path.join(process.cwd(), 'dist/worker/check-parser.js'), { resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16 } })
    : new Worker('const { workerData } = require("node:worker_threads"); ' + DEV_BOOTSTRAP, {
      eval: true, workerData: { module: path.join(process.cwd(), 'worker/check-parser.ts') },
      resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16 },
    })
  worker.on('error', () => { if (parser === worker) parser = null })
  worker.on('exit', () => { if (parser === worker) parser = null })
  parser = worker
  return worker
}

export async function closeParserWorker() {
  clearIdleTimer()
  const worker = parser
  parser = null
  await worker?.terminate()
}

async function isolated(input: object, deadline: number): Promise<unknown> {
  return capacity.run(() => new Promise((resolve, reject) => {
    if (Date.now() >= deadline) return reject(new TaskFailure('PARSER_DEADLINE', true, undefined, true))
    const worker = parserWorker()
    worker.ref()
    let settled = false
    const finish = (error: Error | null, value?: unknown) => {
      if (settled) return
      settled = true; clearTimeout(timer)
      worker.off('message', onMessage); worker.off('error', onError); worker.off('exit', onExit)
      if (error) {
        if (parser === worker) parser = null
        // Failed work cannot leak a late response into the next task.
        void worker.terminate().then(() => reject(error), () => reject(error))
      } else {
        worker.unref()
        idleTimer = setTimeout(() => { if (parser === worker) void closeParserWorker() }, 30_000)
        idleTimer.unref()
        resolve(value)
      }
    }
    const onMessage = (value: unknown) => finish(null, value)
    const onError = () => finish(new TaskFailure('PARSER_CRASH', true, undefined, true))
    const onExit = (code: number) => finish(new TaskFailure(code ? 'PARSER_CRASH' : 'PARSER_NO_RESULT', true, undefined, true))
    const timer = setTimeout(() => finish(new TaskFailure('PARSER_DEADLINE', true, undefined, true)), Math.max(1, Math.min(25_000, deadline - Date.now())))
    worker.once('message', onMessage); worker.once('error', onError); worker.once('exit', onExit)
    try { worker.postMessage(input) } catch { onError() }
  }), AbortSignal.timeout(Math.max(1, deadline - Date.now())))
}
export async function parseMetadataIsolated(html: string, url: string, deadline: number) {
  if (Buffer.byteLength(html) > 1_000_000) throw new TaskFailure('HTML_BODY_LIMIT', false)
  return pageMetadataSchema.parse(await isolated({ operation: 'metadata', html, url }, deadline))
}
export async function evaluateSearchIsolated(evidence: SearchPageEvidence, previous: SearchReceipt | null | undefined, deadline: number, evaluators?: readonly string[]) {
  const observations = await isolated({ operation: 'search', evidence, previous, evaluators }, deadline)
  return searchObservationSchema.array().parse(observations)
}
