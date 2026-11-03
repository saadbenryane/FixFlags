import { execFileSync, spawn } from 'node:child_process'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
const PROJECT = 'c7d6f183-1385-4803-b2db-94eb663eb147'
const ENVIRONMENT = 'public-validation'
const ALLOWED = new Set(['Validation-Web', 'Validation-Worker', 'Validation-Target', 'Postgres-wXo2', 'Redis-ie4W', 'Redis-peQ7', 'Redis-SrYZ'])

/** Own only services started here. Failure and signals share the same cleanup. */
export async function runValidationSession({ names, inspect, dependencies, start, stop, command }) {
  if (!names.length || names.some(name => !ALLOWED.has(name))) throw new Error('Choose explicit public-validation services')
  const before = await inspect(), order = [], visiting = new Set()
  const visit = async name => {
    if (order.includes(name)) return
    if (visiting.has(name)) throw new Error('Validation dependency cycle')
    if (!ALLOWED.has(name)) throw new Error('A validation service refers to an external service')
    if (!before[name] || before[name].running) throw new Error('A required service is already running or unavailable; preserve its owner')
    visiting.add(name)
    for (const dependency of await dependencies(name)) await visit(dependency)
    visiting.delete(name); order.push(name)
  }
  for (const name of names) await visit(name)
  const started = []
  try {
    for (const name of order) { started.push(name); await start(name) }
    return await command()
  } finally {
    const failures = []
    for (const name of started.reverse()) {
      try { await stop(name) } catch { failures.push(name) }
    }
    if (failures.length) throw new Error('Validation cleanup needs attention: ' + failures.join(', '))
  }
}

function api(query, variables = {}) {
  const output = execFileSync('railway', ['api', query, '--variables', JSON.stringify(variables), '--compact'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const result = JSON.parse(output.split('\n')[0])
  if (result.errors?.length) throw new Error('Railway operation failed')
  return result.data
}
async function inventory() {
  const data = api('query($id:String!){project(id:$id){environments{edges{node{id name serviceInstances{edges{node{serviceId serviceName latestDeployment{id status deploymentStopped} activeDeployments{id deploymentStopped}}}}}}}}}', { id: PROJECT })
  const environment = data.project.environments.edges.find(({ node }) => node.name === ENVIRONMENT)?.node
  if (!environment) throw new Error('Validation environment unavailable')
  return { id: environment.id, services: Object.fromEntries(environment.serviceInstances.edges.map(({ node: s }) => [s.serviceName, {
    id: s.serviceId, running: s.activeDeployments.some(d => !d.deploymentStopped), latest: s.latestDeployment,
    deployments: s.activeDeployments.filter(d => !d.deploymentStopped).map(d => d.id),
  }])) }
}
async function main() {
  const separator = process.argv.indexOf('--')
  if (separator < 0 || !process.argv[separator + 1]) throw new Error('Usage: node scripts/validation-session.mjs --service Validation-Web -- <verification command>')
  const { values } = parseArgs({ args: process.argv.slice(2, separator), options: { service: { type: 'string', multiple: true } } })
  const first = await inventory(), envId = first.id
  let child, interrupted = false
  const onSignal = signal => { interrupted = true; child?.kill(signal) }
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal)
  try {
    const code = await runValidationSession({ names: values.service ?? [], inspect: async () => (await inventory()).services,
      dependencies: async name => {
        const data = api('query($p:String!,$e:String!,$s:String!){variables(projectId:$p,environmentId:$e,serviceId:$s,unrendered:true)}', { p: PROJECT, e: envId, s: first.services[name].id })
        return [...new Set(Object.values(data.variables).flatMap(value => [...String(value).matchAll(/\$\{\{([^.}]+)\./g)].map(match => match[1])))]
          .filter(dependency => !['shared', 'self', name].includes(dependency))
      },
      start: async name => {
        if (interrupted) throw new Error('Session interrupted')
        execFileSync('railway', ['redeploy', '--project', PROJECT, '--environment', ENVIRONMENT, '--service', name, '--yes', '--json'], { stdio: 'pipe' })
        const deadline = Date.now() + 600_000
        while (Date.now() < deadline && !interrupted) {
          const state = (await inventory()).services[name]
          if (state.running && state.latest.status === 'SUCCESS' && !state.latest.deploymentStopped) return
          if (['FAILED', 'CRASHED'].includes(state.latest.status)) throw new Error('Validation service failed: ' + name)
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
        throw new Error('Validation startup interrupted or timed out')
      },
      stop: async name => {
        const state = (await inventory()).services[name]
        const ids = new Set([...state.deployments, ...(!state.latest.deploymentStopped ? [state.latest.id] : [])])
        for (const id of ids) api('mutation($id:String!){deploymentStop(id:$id)}', { id })
      },
      command: () => new Promise((resolve, reject) => {
        if (interrupted) return reject(new Error('Session interrupted'))
        child = spawn(process.argv[separator + 1], process.argv.slice(separator + 2), { stdio: 'inherit' })
        child.once('error', reject); child.once('exit', code => resolve(code ?? 1))
      }),
    })
    process.exitCode = code
  } finally { process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal) }
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main().catch(() => { console.error('Validation session failed. Inspect service state before retrying.'); process.exitCode = 1 })
}
