export class GithubPermissionError extends Error {}

async function githubApiCall(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 403 || res.status === 404) {
    const detail = await res.text().catch(() => '')
    throw new GithubPermissionError(
      `GitHub token lacks write access to this repository (${res.status}): ${detail.slice(0, 200)}`
    )
  }
  return res
}

/** Creates a branch ref pointing at an existing commit - used when there is no local patch to push. */
export async function createBranchRef(
  accessToken: string,
  repoFullName: string,
  branchName: string,
  baseSha: string
): Promise<void> {
  const res = await githubApiCall(accessToken, 'POST', `/repos/${repoFullName}/git/refs`, {
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    // 422 with "Reference already exists" is fine - a retry after a partial prior failure.
    if (res.status === 422 && detail.includes('already exists')) return
    throw new Error(`Failed to create branch ${branchName} (${res.status}): ${detail.slice(0, 200)}`)
  }
}

export interface CreatePullRequestResult {
  number: number
  htmlUrl: string
}

export async function createDraftPullRequest(
  accessToken: string,
  repoFullName: string,
  input: { title: string; head: string; base: string; body: string }
): Promise<CreatePullRequestResult> {
  const res = await githubApiCall(accessToken, 'POST', `/repos/${repoFullName}/pulls`, {
    title: input.title,
    head: input.head,
    base: input.base,
    body: input.body,
    draft: true,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Failed to open pull request (${res.status}): ${detail.slice(0, 200)}`)
  }
  const data = (await res.json()) as { number: number; html_url: string }
  return { number: data.number, htmlUrl: data.html_url }
}
