import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parse } from 'dotenv'

export function releaseContainerBuildArguments(settings, gitSha) {
  if (!/^[a-f0-9]{40}$/.test(gitSha ?? '')) throw new Error('Exact candidate SHA is required for the release image')
  const app = new URL(settings.NEXT_PUBLIC_APP_URL)
  const auth = new URL(settings.BETTER_AUTH_URL)
  if (!['http:', 'https:'].includes(app.protocol) || app.username || app.password || auth.username || auth.password ||
      app.origin !== auth.origin || app.pathname !== '/' || auth.pathname !== '/' ||
      app.search || app.hash || auth.search || auth.hash) {
    throw new Error('Release image and authentication must use the same app origin')
  }
  const analyticsId = settings.NEXT_PUBLIC_GA_ID ?? ''
  if (analyticsId && !/^G-[A-Z0-9]+$/.test(analyticsId)) throw new Error('Invalid public analytics measurement ID')
  // Only public build settings enter Docker arguments. Provider credentials
  // remain runtime configuration in the designated environment file.
  return ['build', '-t', 'fixflags:release-check',
    '--build-arg', `NEXT_PUBLIC_APP_URL=${app.origin}`,
    '--build-arg', `NEXT_PUBLIC_GA_ID=${analyticsId}`,
    '--build-arg', `GIT_COMMIT_SHA=${gitSha}`, '.']
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.RELEASE_CONTAINER_ENV_FILE) throw new Error('RELEASE_CONTAINER_ENV_FILE is required')
  const settings = parse(readFileSync(process.env.RELEASE_CONTAINER_ENV_FILE))
  const args = releaseContainerBuildArguments(settings, process.env.RELEASE_EXPECTED_GIT_SHA)
  const result = spawnSync('docker', args, { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
}
