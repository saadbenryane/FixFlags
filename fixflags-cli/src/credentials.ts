import { Entry } from '@napi-rs/keyring'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join } from 'node:path'

const SERVICE = 'FixFlags CLI'
export const API_BASE = (
  process.env.FIXFLAGS_API_URL || 'https://fixflags.com'
).replace(/\/$/, '')

interface Config {
  apiBase?: string
  credentialStorage?: 'keyring' | 'insecure'
  apiKey?: string
}

function configDirectory(): string {
  if (process.env.FIXFLAGS_CONFIG_DIR) return process.env.FIXFLAGS_CONFIG_DIR
  if (platform() === 'win32') {
    return join(process.env.APPDATA || homedir(), 'FixFlags')
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'fixflags')
}

const CONFIG_PATH = join(configDirectory(), 'config.json')

function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) return {}
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Config
  } catch {
    throw new Error(`FixFlags config is malformed: ${CONFIG_PATH}`)
  }
}

function saveConfig(config: Config): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 })
  const temporary = `${CONFIG_PATH}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  })
  chmodSync(temporary, 0o600)
  renameSync(temporary, CONFIG_PATH)
}

function keyringEntry(): Entry {
  return new Entry(SERVICE, API_BASE)
}

export function hasConfiguredCredential(): boolean {
  if (process.env.FIXFLAGS_API_KEY) return true
  const config = loadConfig()
  return config.credentialStorage === 'keyring' || Boolean(config.apiKey)
}

export function requireApiKey(): string {
  if (process.env.FIXFLAGS_API_KEY) return process.env.FIXFLAGS_API_KEY
  const config = loadConfig()
  if (config.credentialStorage === 'keyring') {
    try {
      const key = keyringEntry().getPassword()
      if (key) return key
    } catch (error) {
      throw new Error(
        `The operating-system credential store is unavailable: ${(error as Error).message}. Use FIXFLAGS_API_KEY for CI or run fixflags login --with-token --insecure-storage.`
      )
    }
  }
  if (config.credentialStorage === 'insecure' && config.apiKey) {
    return config.apiKey
  }
  throw new Error(
    'Not authenticated. Run fixflags login, or set FIXFLAGS_API_KEY for CI.'
  )
}

export function saveCredential(
  apiKey: string,
  options: { insecureStorage?: boolean } = {}
): void {
  if (options.insecureStorage) {
    try {
      keyringEntry().deletePassword()
    } catch {
      // The user explicitly selected file storage. An unavailable keyring
      // cannot prevent replacing the active local credential.
    }
    saveConfig({
      apiBase: API_BASE,
      credentialStorage: 'insecure',
      apiKey,
    })
    return
  }
  try {
    keyringEntry().setPassword(apiKey)
  } catch (error) {
    throw new Error(
      `The operating-system credential store is unavailable: ${(error as Error).message}. No credential was saved. Use FIXFLAGS_API_KEY or explicitly pass --insecure-storage.`
    )
  }
  try {
    saveConfig({ apiBase: API_BASE, credentialStorage: 'keyring' })
  } catch (error) {
    try {
      keyringEntry().deletePassword()
    } catch {
      // Preserve the original config-write error below.
    }
    throw error
  }
}

export function removeCredential(): void {
  const config = loadConfig()
  if (config.credentialStorage === 'keyring') {
    try {
      keyringEntry().deletePassword()
    } catch (error) {
      throw new Error(
        `Could not remove the credential from the operating-system store: ${(error as Error).message}`
      )
    }
  }
  rmSync(CONFIG_PATH, { force: true })
}

export async function readSecretFromStdin(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    let value = ''
    for await (const chunk of process.stdin) value += String(chunk)
    return value.trim()
  }

  process.stdout.write(prompt)
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')
  return new Promise((resolve, reject) => {
    let value = ''
    const cleanup = () => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.removeListener('data', onData)
      process.stdout.write('\n')
    }
    const onData = (character: string) => {
      if (character === '\u0003') {
        cleanup()
        reject(new Error('Login cancelled'))
        return
      }
      if (character === '\r' || character === '\n') {
        cleanup()
        resolve(value.trim())
        return
      }
      if (character === '\u007f') {
        value = value.slice(0, -1)
        return
      }
      value += character
    }
    process.stdin.on('data', onData)
  })
}
