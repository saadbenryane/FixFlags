import { MCP_SETUP_COPY } from './mcp-setup'

export const AI_CONNECTION_PATH = '/connect-ai'

export const AI_CONNECTION_COPY = {
  label: 'FixFlags and your AI',
  title: 'Your AI fixes. FixFlags checks.',
  description: 'Give your AI the details it needs to fix a problem. Let FixFlags check the live website before and after.',
  metadataTitle: 'Connect FixFlags to your AI agent | FixFlags',
  benefits: [
    {
      title: 'A second pair of eyes',
      body: 'FixFlags checks the live website itself. An edit being finished, or your AI saying it worked, does not confirm the problem is gone.',
    },
    {
      title: 'Save your building tokens',
      body: 'Scheduled checks run in FixFlags, even when your AI tool is closed. They don’t use that tool’s token allowance. Reading the results and making fixes with your AI still uses its tokens.',
    },
    {
      title: 'Give your AI a clear starting point',
      body: 'Each fix prompt brings the page, the problem, and the expected result together. Your AI can focus on that problem instead of starting with a broad “check everything” request.',
    },
  ],
  connection: {
    available: {
      title: 'Connect once. Use it when you need it.',
      body: 'MCP lets your AI read FixFlags results and request website checks. Choose your agent, approve the access you want to give it, then paste the connection check below.',
      action: 'Set up the connection',
      steps: [
        'Sign in to FixFlags and save your website.',
        'Choose your agent in setup and add the private connection settings it provides.',
        'Paste the connection check into your agent. It confirms access and lists your saved websites without starting a check.',
      ],
    },
    unavailable: {
      title: 'Direct connections are coming soon.',
      body: 'New MCP connections are not available in this beta. You can use fix prompts today by copying and pasting them, with nothing to connect.',
      action: 'How to copy and paste a fix',
      existing: 'Already connected to FixFlags?',
      existingBody: 'This prompt checks an existing connection. It does not install a connection, start a website check, or make changes.',
    },
    privacy: 'Approve access in FixFlags and keep connection keys in your agent’s private settings. Never paste a key into a chat or commit it with your website.',
    workTitle: 'Once connected, start with a problem.',
    workBody: 'Copy a fix prompt from FixFlags into your agent. It can read the recorded details and help make the change. After you review and publish the update, it can ask FixFlags to check the result. The problem is only marked fixed after a fresh check confirms it.',
  },
  prompt: {
    label: 'Connection check prompt',
    body: MCP_SETUP_COPY.verifyPrompt,
    copy: 'Copy connection check',
    copied: 'Connection check copied. Paste it into your agent.',
    manual: 'Couldn’t copy automatically. The prompt is selected below so you can copy it.',
  },
  current: {
    title: 'Copy and paste works today.',
    steps: [
      { title: 'Find the problem', body: 'Enter your website in FixFlags. Save it to get fix prompts and scheduled checks.' },
      { title: 'Copy and paste the fix', body: 'Paste the fix instructions where you built your website, or send them to someone who can help.' },
      { title: 'Check the update', body: 'Review and publish the change. Open the same problem in FixFlags and select Check now.' },
    ],
  },
} as const
