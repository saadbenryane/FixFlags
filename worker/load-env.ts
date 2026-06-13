import { config } from 'dotenv'
import { existsSync } from 'fs'
import path from 'path'

for (const file of ['.env', '.env.local']) {
  const envPath = path.resolve(process.cwd(), file)
  if (existsSync(envPath)) {
    config({ path: envPath, override: file === '.env.local' })
  }
}
