import { MCP_SETUP_COPY } from './mcp-setup'

export const AI_CONNECTION_PATH = '/connect-ai'

export const AI_CONNECTION_COPY = {
  label: 'MCP',
  title: 'Let your agent read the Flag and ask for the recheck.',
  description: 'Connect Cursor, Claude Code, or another coding agent over MCP. It reads your Flags and their evidence, and asks FixFlags to recheck your live site after you publish the fix.',
  metadataTitle: 'Connect FixFlags to your AI agent | FixFlags',
  benefits: [
    {
      title: 'No copying between windows',
      body: 'Your agent opens your Flags and their evidence itself: the page, what happened, and what should happen.',
    },
    {
      title: 'An independent recheck',
      body: 'Your agent saying a fix worked is not proof. FixFlags checks the same page on your live site and marks the Flag fixed only when that fresh check confirms it.',
    },
    {
      title: 'Checks don’t use your tokens',
      body: 'Checks run in FixFlags, even when your AI tool is closed. Reading the results and making fixes with your AI still uses its tokens.',
    },
  ],
  connection: {
    title: 'Connect once. Use it when you need it.',
    body: 'Choose your agent, approve the access you want to give it, then paste the connection check below.',
    action: 'Set up the connection',
    steps: [
      'Sign in to FixFlags and save your website.',
      'Choose your agent in setup and add the private connection settings it provides.',
      'Paste the connection check into your agent. It confirms access and lists your saved websites without starting a check.',
    ],
    privacy: 'Approve access in FixFlags and keep connection keys in your agent’s private settings. Never paste a key into a chat or commit it with your website.',
    workTitle: 'Once connected, start with a Flag.',
    workBody: 'Ask your agent to fix a Flag, or paste its fix instructions. It reads the recorded details and helps make the change. After you review and publish the update, it asks FixFlags to recheck.',
  },
  prompt: {
    label: 'Connection check prompt',
    body: MCP_SETUP_COPY.verifyPrompt,
    copy: 'Copy connection check',
    copied: 'Connection check copied. Paste it into your agent.',
    manual: 'Couldn’t copy automatically. The prompt is selected below so you can copy it.',
  },
} as const
