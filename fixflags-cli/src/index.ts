#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  checkAndPlan,
  recheckAndDiff,
  type FinishPlan,
  type McpCaller,
} from './workflows.js'

const CONFIG_PATH = join(homedir(), '.fixflags')
const API_BASE = (process.env.FIXFLAGS_API_URL || 'https://fixflags.com').replace(/\/$/, '')
const PROMPT_PREVIEW_LENGTH = 700

interface Config {
  apiKey?: string
}

function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) return {}
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Config
  } catch {
    return {}
  }
}

function saveConfig(config: Config): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 })
}

function requireApiKey(): string {
  const apiKey = process.env.FIXFLAGS_API_KEY || loadConfig().apiKey
  if (!apiKey) {
    throw new Error(
      'Not authenticated. Set FIXFLAGS_API_KEY or run: fixflags auth --api-key <key>'
    )
  }
  return apiKey
}

let rpcId = 1

function createMcpCaller(apiKey: string): McpCaller {
  return async (tool, args) => {
    const response = await fetch(`${API_BASE}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: rpcId++,
        method: 'tools/call',
        params: { name: tool, arguments: args },
      }),
    })

    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string }
      result?: { content?: Array<{ type: string; text?: string }> }
    } | null

    if (!response.ok) {
      throw new Error(body?.error?.message || `FixFlags API error ${response.status}`)
    }
    if (body?.error) throw new Error(body.error.message || 'FixFlags tool error')

    const text = body?.result?.content?.find((item) => item.type === 'text')?.text
    if (!text) throw new Error(`FixFlags returned no data for ${tool}`)
    try {
      return JSON.parse(text)
    } catch {
      return { raw: text }
    }
  }
}

function promptPreview(prompt: string | null | undefined, full: boolean): string | null {
  if (!prompt) return null
  if (full || prompt.length <= PROMPT_PREVIEW_LENGTH) return prompt
  return `${prompt.slice(0, PROMPT_PREVIEW_LENGTH)}\n[truncated, rerun with --full]`
}

function printPlan(
  plan: FinishPlan | undefined,
  full: boolean,
  limit?: number,
  label = 'All fixes'
): void {
  const allItems = plan?.items ?? []
  const items = limit == null ? allItems : allItems.slice(0, limit)
  if (items.length === 0) {
    console.log(chalk.green(`${label}: 0 unresolved improvements.`))
    return
  }

  console.log(chalk.bold(`${label} (${items.length})`))
  for (const [index, item] of items.entries()) {
    console.log('')
    console.log(
      `${chalk.bold(`${index + 1}.`)} ${chalk.red(item.severity)} · ${chalk.cyan(item.rubric)}`
    )
    console.log(item.problem)
    const prompt = promptPreview(item.fixPrompt, full)
    if (prompt) console.log(`${chalk.gray('Fix:')}\n${prompt}`)
  }
}

function fail(error: unknown, json = false): void {
  const message = (error as Error).message
  const recovery = message.includes('authenticated')
    ? 'Set FIXFLAGS_API_KEY or run: fixflags auth --api-key <key>'
    : 'Check the command input and retry. Run fixflags --help if needed.'
  if (json) {
    console.error(JSON.stringify({ error: { code: 'FIXFLAGS_ERROR', message, recovery } }))
  } else {
    console.error(chalk.red(`Error: ${message}`))
    console.error(chalk.gray(`Next: ${recovery}`))
  }
  process.exitCode = 1
}

const program = new Command()

program
  .name('fixflags')
  .description('Finish and verify AI-built products')
  .version('0.2.0-beta.1')
  .option('--json', 'Print structured JSON')
  .action((options: { json?: boolean }) => {
    const authenticated = Boolean(process.env.FIXFLAGS_API_KEY || loadConfig().apiKey)
    const payload = {
      schemaVersion: 1,
      service: 'FixFlags',
      api: API_BASE,
      authenticated,
      workflows: ['check <url>', 'recheck <reportId>', 'status <reportId>'],
      next: authenticated
        ? ['fixflags check <url>', 'fixflags --help']
        : ['fixflags auth --api-key <key>', 'Create a key at https://fixflags.com/settings/api-keys'],
    }
    if (options.json) console.log(JSON.stringify(payload, null, 2))
    else {
      console.log('service: FixFlags')
      console.log(`api: ${payload.api}`)
      console.log(`authenticated: ${authenticated ? 'yes' : 'no'}`)
      console.log('workflows: 3')
      for (const workflow of payload.workflows) console.log(`  ${workflow}`)
      console.log('next:')
      for (const item of payload.next) console.log(`  ${item}`)
    }
  })

program
  .command('auth')
  .description('Save a FixFlags API key locally')
  .option('--api-key <key>', 'API key from fixflags.com/settings/api-keys')
  .action((options: { apiKey?: string }) => {
    const apiKey = options.apiKey || process.env.FIXFLAGS_API_KEY
    if (!apiKey) {
      console.log('Create an API key at https://fixflags.com/settings/api-keys')
      console.log('Then run: fixflags auth --api-key <your-key>')
      return
    }
    saveConfig({ apiKey })
    console.log(chalk.green('Authenticated with FixFlags.'))
  })

function parseScanAccessFromCli(options: {
  scanAccessFile?: string
  basicAuth?: string
  cookie?: string
}): Record<string, unknown> | undefined {
  if (options.scanAccessFile) {
    const raw = JSON.parse(readFileSync(options.scanAccessFile, 'utf-8')) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Scan access file must contain a JSON object')
    }
    return raw as Record<string, unknown>
  }
  const config: Record<string, unknown> = {}
  if (options.basicAuth) {
    const separator = options.basicAuth.indexOf(':')
    if (separator <= 0) throw new Error('Basic auth must be user:password')
    config.httpBasic = {
      username: options.basicAuth.slice(0, separator),
      password: options.basicAuth.slice(separator + 1),
    }
  }
  if (options.cookie) {
    config.cookies = [{ name: 'session', value: options.cookie }]
  }
  return Object.keys(config).length > 0 ? config : undefined
}

program
  .command('check <url>')
  .description('Check a URL and return every ranked fix')
  .option('--wait', 'Wait for the completed check', true)
  .option('--no-wait', 'Return as soon as the check is queued')
  .option('--plan', 'Return the complete ranked fix list', true)
  .option('--single', 'Check only the given URL')
  .option('--limit <count>', 'Print only the first count fixes')
  .option('--full', 'Print complete fix prompts')
  .option('--scan-access-file <path>', 'JSON file with httpBasic, cookies, or headers (Agency)')
  .option('--basic-auth <credentials>', 'HTTP basic auth as user:password (Agency)')
  .option('--cookie <value>', 'Session cookie value for protected previews (Agency)')
  .option('--json', 'Print structured JSON')
  .action(
    async (
      url: string,
      options: {
        wait: boolean
        plan?: boolean
        single?: boolean
        limit?: string
        full?: boolean
        scanAccessFile?: string
        basicAuth?: string
        cookie?: string
        json?: boolean
      }
    ) => {
      const json = Boolean(options.json || program.opts().json)
      const spinner = ora({ text: 'Checking product...', isEnabled: !json }).start()
      try {
        const call = createMcpCaller(requireApiKey())
        const scanAccess = parseScanAccessFromCli(options)
        const result = await checkAndPlan(call, url, {
          wait: options.wait,
          single: Boolean(options.single),
          apiBase: API_BASE,
          scanAccess,
        })

        spinner.stop()
        const hasCritical = Boolean(
          result.rubrics?.some((rubric) => (rubric.criticalCount ?? 0) > 0)
        )
        if (json) {
          console.log(JSON.stringify(result, null, 2))
          if (hasCritical) process.exitCode = 1
          return
        }
        if (!options.wait) {
          console.log(`Check queued: ${result.reportId}`)
          console.log(`Report: ${result.reportUrl}`)
          return
        }

        console.log(chalk.bold.cyan('FixFlags Check'))
        console.log(`Report: ${result.reportUrl}`)
        if (result.score != null) console.log(`Score: ${result.score}`)
        if (result.verdict) console.log(`Verdict: ${result.verdict}`)
        if (result.technologyProfile?.technologies.length) {
          console.log(
            `Made with: ${result.technologyProfile.technologies.map((technology) => technology.name).join(', ')}`
          )
        }
        console.log('')
        const limit = options.limit ? Number.parseInt(options.limit, 10) : undefined
        if (limit != null && (!Number.isInteger(limit) || limit < 1)) {
          throw new Error('--limit must be a positive integer')
        }
        printPlan(result.fixList ?? result.finishPlan, Boolean(options.full), limit)
        console.log('')
        console.log(chalk.gray(`Next: fixflags recheck ${result.reportId} --wait --diff`))

        if (hasCritical) process.exitCode = 1
      } catch (error) {
        spinner.stop()
        fail(error, json)
      }
    }
  )

program
  .command('recheck <reportId>')
  .description('Run a fresh check and show what improved or regressed')
  .option('--wait', 'Wait for the completed re-check', true)
  .option('--no-wait', 'Return as soon as the re-check is queued')
  .option('--diff', 'Show the verification diff', true)
  .option('--limit <count>', 'Print only the first count remaining fixes')
  .option('--full', 'Print complete remaining fix prompts')
  .option('--json', 'Print structured JSON')
  .action(
    async (
      reportId: string,
      options: { wait: boolean; diff?: boolean; limit?: string; full?: boolean; json?: boolean }
    ) => {
      const json = Boolean(options.json || program.opts().json)
      const spinner = ora({ text: 'Re-checking product...', isEnabled: !json }).start()
      try {
        const result = await recheckAndDiff(createMcpCaller(requireApiKey()), reportId, {
          wait: options.wait,
        })
        spinner.stop()

        if (json) {
          console.log(JSON.stringify(result, null, 2))
          return
        }
        if (!options.wait) {
          console.log(`Re-check queued: ${result.reportId}`)
          return
        }

        console.log(chalk.bold.cyan('FixFlags Re-check'))
        console.log(`Report: ${result.reportUrl || `${API_BASE}/report/${result.reportId}`}`)
        if (options.diff && result.diff) {
          console.log('')
          console.log(chalk.bold('Verification'))
          console.log(`Fixed: ${result.diff.fixed}`)
          console.log(`Remaining: ${result.diff.remaining}`)
          console.log(`New: ${result.diff.newIssues}`)
          console.log(`Regressed: ${result.diff.regressed}`)
        }
        console.log('')
        if (result.nextFixList ?? result.nextFinishPlan) {
          const limit = options.limit ? Number.parseInt(options.limit, 10) : undefined
          if (limit != null && (!Number.isInteger(limit) || limit < 1)) {
            throw new Error('--limit must be a positive integer')
          }
          printPlan(result.nextFixList ?? result.nextFinishPlan, Boolean(options.full), limit)
        }
      } catch (error) {
        spinner.stop()
        fail(error, json)
      }
    }
  )

program
  .command('status <reportId>')
  .description('Get the current status of a check')
  .option('--json', 'Print structured JSON')
  .action(async (reportId: string, options: { json?: boolean }) => {
    const json = Boolean(options.json || program.opts().json)
    try {
      const result = await createMcpCaller(requireApiKey())('ff_get_check_status', {
        reportId,
      })
      if (json) console.log(JSON.stringify(result, null, 2))
      else console.log(`Status: ${(result as { status?: string }).status ?? 'UNKNOWN'}`)
    } catch (error) {
      fail(error, json)
    }
  })

program.parseAsync().catch(fail)
