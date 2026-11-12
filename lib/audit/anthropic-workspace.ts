/** Multi-workspace credentials select their authorized workspace on every request. */
export function anthropicWorkspaceOptions() {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim()
  return workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}
}
