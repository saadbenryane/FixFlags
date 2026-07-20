/**
 * Drop Flags whose problem/evidence looks like Scout-style tooling false positives
 * (session dump paths, playwright-mcp artifacts, /tmp YAML) rather than product bugs.
 */
const TOOLING_PATH_NOISE =
  /playwright-mcp|\/tmp\/[^\s]*\.ya?ml\b|\/tmp\/[^\s]*\.yml\b|\.playwright[^\s]*\.ya?ml\b/i

export function looksLikeToolingPathNoise(text: string): boolean {
  return TOOLING_PATH_NOISE.test(text)
}

export function filterToolingPathFlags<T extends { problem: string; evidence: string }>(
  flags: T[]
): T[] {
  return flags.filter((flag) => !looksLikeToolingPathNoise(`${flag.problem}\n${flag.evidence}`))
}
