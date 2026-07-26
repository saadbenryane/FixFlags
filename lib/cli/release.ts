import cliPackage from '@/fixflags-cli/package.json'

export const CLI_RELEASE = {
  packageName: 'fixflags',
  version: cliPackage.version,
  tag: cliPackage.version.includes('-') ? 'beta' : 'latest',
} as const

export async function getCliReleaseAvailability() {
  const response = await fetch(
    `https://registry.npmjs.org/${CLI_RELEASE.packageName}/${encodeURIComponent(CLI_RELEASE.version)}`,
    { next: { revalidate: 300 } }
  ).catch(() => null)
  if (!response?.ok) {
    return { ...CLI_RELEASE, available: false as const }
  }
  const manifest = (await response.json().catch(() => null)) as {
    version?: string
    dist?: { tarball?: string }
  } | null
  return {
    ...CLI_RELEASE,
    available:
      manifest?.version === CLI_RELEASE.version &&
      typeof manifest.dist?.tarball === 'string',
  }
}
