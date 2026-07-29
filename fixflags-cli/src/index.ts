#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { readFileSync } from 'node:fs'
import {
  checkAndPlan,
  recheckAndDiff,
  type FinishPlan,
  type McpCaller,
} from './workflows.js'
import {
  API_BASE,
  getCredential,
  hasConfiguredCredential,
  removeCredential,
  requireApiKey,
} from './credentials.js'
import {
  fetchIdentity,
  loginWithBrowser,
  loginWithToken,
  revokeCredential,
} from './auth.js'
import { EDITORS, initializeFixFlags, type Editor } from './init.js'
import { runMcpBridge } from './mcp-bridge.js'
const PROMPT_PREVIEW_LENGTH = 700
const CLI_VERSION = (
  JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  ) as { version: string }
).version

let rpcId = 1

function createMcpCaller(apiKey?: string): McpCaller {
  return async (tool, args) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    }
    if (apiKey) headers['x-api-key'] = apiKey
    const response = await fetch(`${API_BASE}/api/mcp`, {
      method: 'POST',
      headers,
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
    ? 'Run fixflags login, or set FIXFLAGS_API_KEY for CI.'
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
  .version(CLI_VERSION)
  .option('--json', 'Print structured JSON')
  .action((options: { json?: boolean }) => {
    const authenticated = hasConfiguredCredential()
    const payload = {
      schemaVersion: 1,
      service: 'FixFlags',
      api: API_BASE,
      authenticated,
      workflows: ['check <url>', 'recheck <reportId>', 'status <reportId>'],
      next: authenticated
        ? ['fixflags check <url>', 'fixflags --help']
        : ['npx fixflags check <url>', 'fixflags login', 'fixflags init'],
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
  .command('login')
  .description('Connect the CLI to your FixFlags account')
  .option('--with-token', 'Read an existing API key from a hidden prompt or standard input')
  .option(
    '--insecure-storage',
    'Explicitly store the credential in a mode-0600 config file instead of the OS credential store'
  )
  .action(
    async (options: { withToken?: boolean; insecureStorage?: boolean }) => {
      try {
        if (process.env.FIXFLAGS_API_KEY) {
          const identity = await fetchIdentity(process.env.FIXFLAGS_API_KEY)
          console.log(
            chalk.green(`Authenticated as ${identity.user.email} through FIXFLAGS_API_KEY.`)
          )
          return
        }
        const identity = options.withToken
          ? await loginWithToken(options)
          : await loginWithBrowser(options)
        console.log(chalk.green(`Authenticated as ${identity.user.email}.`))
        if (options.insecureStorage) {
          console.log(
            chalk.yellow(
              'Credential stored in the local config because --insecure-storage was explicitly selected.'
            )
          )
        }
      } catch (error) {
        fail(error)
      }
    }
  )

program
  .command('whoami')
  .description('Show the account used by the CLI')
  .option('--json', 'Print structured JSON')
  .action(async (options: { json?: boolean }) => {
    const json = Boolean(options.json || program.opts().json)
    try {
      const apiKey = await getCredential()
      if (!apiKey) throw new Error('Not authenticated. Run fixflags login, or set FIXFLAGS_API_KEY for CI.')
      const identity = await fetchIdentity(apiKey)
      if (json) console.log(JSON.stringify(identity, null, 2))
      else {
        console.log(identity.user.email)
        console.log(`Plan: ${identity.user.plan}`)
        console.log(`API: ${API_BASE}`)
      }
    } catch (error) {
      fail(error, json)
    }
  })

program
  .command('logout')
  .description('Revoke the CLI credential and remove it from this computer')
  .option('--local-only', 'Remove the local credential without revoking it')
  .action(async (options: { localOnly?: boolean }) => {
    try {
      if (process.env.FIXFLAGS_API_KEY) {
        throw new Error(
          'FIXFLAGS_API_KEY is set. Remove it from the environment to log out.'
        )
      }
      const apiKey = requireApiKey()
      if (!options.localOnly) await revokeCredential(apiKey)
      removeCredential()
      console.log(
        chalk.green(
          options.localOnly
            ? 'Local CLI credential removed.'
            : 'CLI credential revoked and removed.'
        )
      )
    } catch (error) {
      fail(error)
    }
  })

program
  .command('init [url]')
  .description('Connect FixFlags to this project and install its customer skill')
  .option(
    '--editor <editor>',
    `Editor to configure (${[...EDITORS, 'all'].join(', ')})`
  )
  .option('--scope <scope>', 'Install for this project or this user', 'project')
  .option('--dry-run', 'Show the files that would change without writing them')
  .option('--yes', 'Accept detected settings without prompting')
  .action(
    async (
      url: string | undefined,
      options: {
        editor?: string
        scope?: string
        dryRun?: boolean
        yes?: boolean
      }
    ) => {
      try {
        if (
          options.editor &&
          options.editor !== 'all' &&
          !EDITORS.includes(options.editor as Editor)
        ) {
          throw new Error(`--editor must be one of ${[...EDITORS, 'all'].join(', ')}`)
        }
        if (options.scope !== 'project' && options.scope !== 'user') {
          throw new Error('--scope must be project or user')
        }
        const result = await initializeFixFlags({
          editor: options.editor as Editor | 'all' | undefined,
          scope: options.scope,
          productUrl: url,
          dryRun: options.dryRun,
        })
        console.log(
          result.dryRun
            ? 'FixFlags init preview:'
            : chalk.green('FixFlags connected to this project.')
        )
        for (const file of result.files) console.log(`  ${file}`)
        console.log(`Skill: ${result.skillUrl}`)
        if (!process.env.FIXFLAGS_API_KEY) {
          console.log(
            chalk.gray(
              'MCP uses the CLI credential store through fixflags mcp; no secret was written to the project.'
            )
          )
        }
      } catch (error) {
        fail(error)
      }
    }
  )

program
  .command('mcp')
  .description('Run the secure local bridge used by editor MCP configurations')
  .action(async () => {
    try {
      await runMcpBridge()
    } catch (error) {
      console.error((error as Error).message)
      process.exitCode = 1
    }
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
  .option('--scan-access-file <path>', 'JSON file with httpBasic, cookies, or headers (Studio)')
  .option('--basic-auth <credentials>', 'HTTP basic auth as user:password (Studio)')
  .option('--cookie <value>', 'Session cookie value for protected previews (Studio)')
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
        const apiKey = await getCredential()
        const call = createMcpCaller(apiKey ?? undefined)
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
        printPlan(result.fixList, Boolean(options.full), limit)
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
        const apiKey = await getCredential()
        if (!apiKey) throw new Error('Re-check requires authentication. Run fixflags login first, or set FIXFLAGS_API_KEY for CI.')
        const result = await recheckAndDiff(createMcpCaller(apiKey), reportId, {
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
      const apiKey = await getCredential()
      if (!apiKey) throw new Error('Not authenticated. Run fixflags login, or set FIXFLAGS_API_KEY for CI.')
      const result = await createMcpCaller(apiKey)('ff_get_check_status', {
        reportId,
      })
      if (json) console.log(JSON.stringify(result, null, 2))
      else console.log(`Status: ${(result as { status?: string }).status ?? 'UNKNOWN'}`)
    } catch (error) {
      fail(error, json)
    }
  })

program.parseAsync().catch(fail)
