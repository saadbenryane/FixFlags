export const EDITOR_MARK_NAMES = [
  'Cursor',
  'Claude Code',
  'Windsurf',
  'Lovable',
  'Bolt',
  'Replit',
  'Codex',
  'Devin',
] as const

export type EditorMarkName = (typeof EDITOR_MARK_NAMES)[number]

export const EDITOR_INTEGRATION_KEYS = [
  'lovable',
  'bolt',
  'cursor',
  'replit',
  'claudeCode',
  'windsurf',
  'codex',
  'devin',
] as const

export type EditorIntegrationKey = (typeof EDITOR_INTEGRATION_KEYS)[number]
export type EditorSetupMode = 'local-config' | 'hosted-connector'
export type EditorPromptProfile =
  | 'universal'
  | 'cursor'
  | 'claude'
  | 'windsurf'
  | 'lovable'
  | 'bolt'

export interface EditorIntegrationDefinition {
  key: EditorIntegrationKey
  label: EditorMarkName
  docsAnchor: string
  homepageRow: 1 | 2
  homepageOrder: number
  transport: 'streamable-http'
  authentication: 'bearer'
  setupMode: EditorSetupMode
  setupLocation: string
  apiKeyClient: EditorIntegrationKey
  promptProfile: EditorPromptProfile
  cliManaged: boolean
  oneClickInstall: boolean
  officialDocsUrl: string
  productionSmoke: 'pending' | 'verified'
}

export const EDITOR_INTEGRATIONS: readonly EditorIntegrationDefinition[] = [
  {
    key: 'lovable',
    label: 'Lovable',
    docsAnchor: 'lovable',
    homepageRow: 1,
    homepageOrder: 1,
    transport: 'streamable-http',
    authentication: 'bearer',
    setupMode: 'hosted-connector',
    setupLocation: 'Settings → Connectors → Personal connectors → New MCP server',
    apiKeyClient: 'lovable',
    promptProfile: 'lovable',
    cliManaged: false,
    oneClickInstall: false,
    officialDocsUrl: 'https://docs.lovable.dev/integrations/mcp-servers',
    productionSmoke: 'pending',
  },
  {
    key: 'bolt',
    label: 'Bolt',
    docsAnchor: 'bolt',
    homepageRow: 1,
    homepageOrder: 2,
    transport: 'streamable-http',
    authentication: 'bearer',
    setupMode: 'hosted-connector',
    setupLocation: 'Settings → Connectors → MCP → Add server',
    apiKeyClient: 'bolt',
    promptProfile: 'bolt',
    cliManaged: false,
    oneClickInstall: false,
    officialDocsUrl: 'https://support.bolt.new/building/using-bolt/connect-mcp',
    productionSmoke: 'pending',
  },
  {
    key: 'cursor',
    label: 'Cursor',
    docsAnchor: 'cursor',
    homepageRow: 1,
    homepageOrder: 3,
    transport: 'streamable-http',
    authentication: 'bearer',
    setupMode: 'local-config',
    setupLocation: 'Project .cursor/mcp.json or user ~/.cursor/mcp.json',
    apiKeyClient: 'cursor',
    promptProfile: 'cursor',
    cliManaged: true,
    oneClickInstall: true,
    officialDocsUrl: 'https://docs.cursor.com/context/model-context-protocol',
    productionSmoke: 'pending',
  },
  {
    key: 'replit',
    label: 'Replit',
    docsAnchor: 'replit',
    homepageRow: 1,
    homepageOrder: 4,
    transport: 'streamable-http',
    authentication: 'bearer',
    setupMode: 'hosted-connector',
    setupLocation: 'Open the Replit MCP integrations panel and add a custom server',
    apiKeyClient: 'replit',
    promptProfile: 'universal',
    cliManaged: false,
    oneClickInstall: false,
    officialDocsUrl: 'https://docs.replit.com/build/connect-via-mcp',
    productionSmoke: 'pending',
  },
  {
    key: 'claudeCode',
    label: 'Claude Code',
    docsAnchor: 'claude-code',
    homepageRow: 2,
    homepageOrder: 1,
    transport: 'streamable-http',
    authentication: 'bearer',
    setupMode: 'local-config',
    setupLocation: 'Project .mcp.json or user Claude Code MCP configuration',
    apiKeyClient: 'claudeCode',
    promptProfile: 'claude',
    cliManaged: true,
    oneClickInstall: false,
    officialDocsUrl: 'https://docs.anthropic.com/en/docs/claude-code/mcp',
    productionSmoke: 'pending',
  },
  {
    key: 'windsurf',
    label: 'Windsurf',
    docsAnchor: 'windsurf',
    homepageRow: 2,
    homepageOrder: 2,
    transport: 'streamable-http',
    authentication: 'bearer',
    setupMode: 'local-config',
    setupLocation: 'Windsurf Settings → Cascade → MCP Servers',
    apiKeyClient: 'windsurf',
    promptProfile: 'windsurf',
    cliManaged: true,
    oneClickInstall: false,
    officialDocsUrl: 'https://docs.windsurf.com/windsurf/cascade/mcp',
    productionSmoke: 'pending',
  },
  {
    key: 'codex',
    label: 'Codex',
    docsAnchor: 'codex',
    homepageRow: 2,
    homepageOrder: 3,
    transport: 'streamable-http',
    authentication: 'bearer',
    setupMode: 'local-config',
    setupLocation: 'User ~/.codex/config.toml or project .codex/config.toml',
    apiKeyClient: 'codex',
    promptProfile: 'universal',
    cliManaged: true,
    oneClickInstall: false,
    officialDocsUrl: 'https://developers.openai.com/codex/mcp',
    productionSmoke: 'pending',
  },
  {
    key: 'devin',
    label: 'Devin',
    docsAnchor: 'devin',
    homepageRow: 2,
    homepageOrder: 4,
    transport: 'streamable-http',
    authentication: 'bearer',
    setupMode: 'hosted-connector',
    setupLocation: 'Settings → MCP Marketplace → Add Your Own',
    apiKeyClient: 'devin',
    promptProfile: 'universal',
    cliManaged: false,
    oneClickInstall: false,
    officialDocsUrl: 'https://docs.devin.ai/work-with-devin/mcp',
    productionSmoke: 'pending',
  },
] as const

export const HOMEPAGE_EDITOR_INTEGRATIONS = [...EDITOR_INTEGRATIONS].sort(
  (a, b) => a.homepageRow - b.homepageRow || a.homepageOrder - b.homepageOrder
)

export const CLI_MANAGED_EDITOR_INTEGRATIONS = EDITOR_INTEGRATIONS.filter(
  (editor) => editor.cliManaged
)

export function isEditorIntegrationKey(value: unknown): value is EditorIntegrationKey {
  return (
    typeof value === 'string' &&
    EDITOR_INTEGRATION_KEYS.includes(value as EditorIntegrationKey)
  )
}

export function getEditorIntegration(
  key: EditorIntegrationKey
): EditorIntegrationDefinition {
  const editor = EDITOR_INTEGRATIONS.find((candidate) => candidate.key === key)
  if (!editor) throw new Error(`Unsupported editor integration: ${key}`)
  return editor
}

export function editorDocsHref(
  editor: Pick<EditorIntegrationDefinition, 'docsAnchor'>
): `/docs/integrations#${string}` {
  return `/docs/integrations#${editor.docsAnchor}`
}

