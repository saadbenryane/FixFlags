import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, machine, platform } from 'node:os'
import { dirname, join } from 'node:path'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import type { Entry as KeyringEntry } from '@napi-rs/keyring'

const SERVICE = 'FixFlags CLI'
export const API_BASE = (process.env.FIXFLAGS_API_URL || 'https://fixflags.com').replace(/\/$/, '')

type Storage = 'keyring' | 'encrypted'

interface Config {
  apiBase?: string
  credentialStorage?: Storage
}

function configDirectory(): string {
  if (process.env.FIXFLAGS_CONFIG_DIR) return process.env.FIXFLAGS_CONFIG_DIR
  if (platform() === 'win32') {
    return join(process.env.APPDATA || homedir(), 'FixFlags')
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'fixflags')
}

const CONFIG_PATH = join(configDirectory(), 'config.json')
const ENCRYPTED_PATH = join(configDirectory(), 'credentials.enc')
const loadOptionalModule = createRequire(import.meta.url)

function machineKey(): string {
  return createHash('sha256').update(`${machine()}:${homedir()}:fixflags-credential-v1`).digest('hex')
}

function encryptValue(plaintext: string): string {
  const key = Buffer.from(machineKey(), 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

function decryptValue(encoded: string): string {
  const parts = encoded.split('.')
  if (parts.length !== 3) throw new Error('Malformed encrypted credential')
  const [ivB64, tagB64, dataB64] = parts
  const key = Buffer.from(machineKey(), 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return decipher.update(Buffer.from(dataB64, 'base64url'), undefined, 'utf8') + decipher.final('utf8')
}

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

function tryKeyringSync<T>(fn: (entry: KeyringEntry) => T): T | null {
  try {
    const { Entry } = loadOptionalModule('@napi-rs/keyring') as typeof import('@napi-rs/keyring')
    const entry = new Entry(SERVICE, API_BASE)
    return fn(entry)
  } catch {
    return null
  }
}

async function tryKeyringAsync<T>(
  fn: (entry: KeyringEntry) => T
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    const { Entry } = await import('@napi-rs/keyring')
    const entry = new Entry(SERVICE, API_BASE)
    return { ok: true, value: fn(entry) }
  } catch (error) {
    return { ok: false, error }
  }
}

export function hasConfiguredCredential(): boolean {
  if (process.env.FIXFLAGS_API_KEY) return true
  const config = loadConfig()
  if (!config.credentialStorage) return false
  if (config.credentialStorage === 'keyring') return tryKeyringSync((entry) => entry.getPassword()) !== null
  if (config.credentialStorage === 'encrypted') return existsSync(ENCRYPTED_PATH)
  return false
}

export async function getCredential(): Promise<string | null> {
  if (process.env.FIXFLAGS_API_KEY) return process.env.FIXFLAGS_API_KEY
  const config = loadConfig()
  if (!config.credentialStorage) return null

  if (config.credentialStorage === 'keyring') {
    const result = await tryKeyringAsync((entry) => entry.getPassword())
    if (result.ok && result.value) return result.value
    return null
  }

  if (config.credentialStorage === 'encrypted') {
    if (!existsSync(ENCRYPTED_PATH)) return null
    try {
      const blob = readFileSync(ENCRYPTED_PATH, 'utf8').trim()
      return decryptValue(blob)
    } catch {
      return null
    }
  }

  return null
}

export function requireApiKey(): string {
  if (process.env.FIXFLAGS_API_KEY) return process.env.FIXFLAGS_API_KEY
  const config = loadConfig()

  if (config.credentialStorage === 'keyring') {
    const result = tryKeyringSync((entry) => entry.getPassword())
    if (result) return result
  }

  if (config.credentialStorage === 'encrypted') {
    if (!existsSync(ENCRYPTED_PATH)) {
      throw new Error('Encrypted credential file not found. Run fixflags login, or set FIXFLAGS_API_KEY for CI.')
    }
    try {
      const blob = readFileSync(ENCRYPTED_PATH, 'utf8').trim()
      return decryptValue(blob)
    } catch {
      throw new Error('Failed to decrypt credential. Run fixflags login again, or set FIXFLAGS_API_KEY for CI.')
    }
  }

  throw new Error('Not authenticated. Run fixflags login, or set FIXFLAGS_API_KEY for CI.')
}

export async function saveCredential(apiKey: string, options?: { insecureStorage?: boolean }): Promise<void> {
  if (!options?.insecureStorage) {
    const keyringResult = await tryKeyringAsync((entry) => entry.setPassword(apiKey))
    if (keyringResult.ok) {
      saveConfig({ apiBase: API_BASE, credentialStorage: 'keyring' })
      return
    }
  }

  const encrypted = encryptValue(apiKey)
  mkdirSync(dirname(ENCRYPTED_PATH), { recursive: true, mode: 0o700 })
  const temporary = `${ENCRYPTED_PATH}.${process.pid}.tmp`
  writeFileSync(temporary, `${encrypted}\n`, { mode: 0o600 })
  chmodSync(temporary, 0o600)
  renameSync(temporary, ENCRYPTED_PATH)
  saveConfig({ apiBase: API_BASE, credentialStorage: 'encrypted' })
}

export function removeCredential(): void {
  const config = loadConfig()
  if (config.credentialStorage === 'keyring') {
    tryKeyringSync((entry) => entry.deletePassword())
  }
  rmSync(CONFIG_PATH, { force: true })
  if (existsSync(ENCRYPTED_PATH)) rmSync(ENCRYPTED_PATH, { force: true })
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
