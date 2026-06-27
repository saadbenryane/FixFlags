/** Repos larger than this (GitHub API reports size in KB) are rejected before cloning. */
export const MAX_REPO_SIZE_KB = 500_000 // ~500 MB

/** Caps applied while walking the checked-out tree, so a huge monorepo can't blow up the worker. */
export const MAX_FILES_SCANNED = 3000
export const MAX_FILE_SIZE_BYTES = 512 * 1024 // 512 KB
export const MAX_TOTAL_BYTES_SCANNED = 50 * 1024 * 1024 // 50 MB

export const SCAN_TIMEOUT_MS = 5 * 60 * 1000

export const SKIPPED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  'vendor',
  '.turbo',
  '.cache',
])

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp4', '.mov', '.avi', '.webm', '.mp3', '.wav',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.pdf', '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
  '.lock',
])

export function isLikelyBinaryPath(path: string): boolean {
  const lastDot = path.lastIndexOf('.')
  if (lastDot === -1) return false
  return BINARY_EXTENSIONS.has(path.slice(lastDot).toLowerCase())
}
