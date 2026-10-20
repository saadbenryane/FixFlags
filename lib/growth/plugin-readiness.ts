/** Package checks cannot establish client, authorization, or production acceptance. */
export function inspectChatgptPluginReadiness(discovery: { enabled: boolean; requirements: readonly string[] }) {
  return {
    discoveryEnabled: discovery.enabled,
    submissionReady: false as const,
    evidenceStatus: 'not-established' as const,
    blockers: [
      ...(!discovery.enabled ? ['Public MCP discovery is disabled by the existing launch gate.'] : []),
      ...discovery.requirements.map((requirement) => `Independent live evidence required: ${requirement}`),
      'Credentialed ChatGPT and Codex client acceptance has not been supplied and independently validated.',
      'Executed reviewer cases, a real accessible demo recording and secure reviewer access remain required.',
      'Developer identity, domain ownership, current public legal/support URLs and portal review acceptance remain unverified.',
    ],
  }
}
