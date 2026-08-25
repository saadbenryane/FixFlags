/** Normalize the deployed revision without exposing invalid build metadata. */
export function resolveCommitSha(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const candidate = [env.RAILWAY_GIT_COMMIT_SHA, env.GIT_COMMIT_SHA]
    .find((value) => value && /^[a-f0-9]{40}$/i.test(value))
  return candidate?.toLowerCase() ?? null
}
