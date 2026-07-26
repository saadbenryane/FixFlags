const packageName = 'fixflags'
const versionFlagIndex = process.argv.indexOf('--version')
const requestedVersion =
  (versionFlagIndex >= 0 ? process.argv[versionFlagIndex + 1] : undefined) ||
  (await import('../fixflags-cli/package.json', { with: { type: 'json' } })).default
    .version
const response = await fetch(
  `https://registry.npmjs.org/${packageName}/${encodeURIComponent(requestedVersion)}`
)

if (!response.ok) {
  console.error(
    `fixflags@${requestedVersion} is not available from npm (${response.status}).`
  )
  process.exit(1)
}
const manifest = await response.json()
if (manifest.version !== requestedVersion || !manifest.dist?.tarball) {
  console.error(`npm returned an invalid manifest for fixflags@${requestedVersion}.`)
  process.exit(1)
}
console.log(`PASS fixflags@${requestedVersion} is available from npm`)
