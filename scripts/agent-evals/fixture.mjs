import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { config } from './config.mjs'

export function loadFixture(name) {
  const path = join(config.fixtureDir, `${name}.html`)
  if (!existsSync(path)) {
    throw new Error(`Fixture not found: ${path}`)
  }
  return readFileSync(path, 'utf8')
}

export function listFixtures() {
  if (!existsSync(config.fixtureDir)) return []
  return readdirSync(config.fixtureDir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace('.html', ''))
}
