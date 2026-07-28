import { BRAND, SITE_URL } from './brand'

export const MCP_DOCS = {
  headline: 'MCP Integration',
  subhead:
    'Your agent can check and fix your site without you copy-pasting URLs. Connect FixFlags to your AI coding tool.',
  quickStart: [
    'Choose the deployed product URL you want FixFlags to check',
    'Install the verified CLI release and run fixflags login',
    'Run fixflags init to connect MCP and install the FixFlags customer skill',
    'Run fixflags check <url> --wait --plan, then Re-check the original report after deploying a fix',
  ],
  builderRequired: 'Requires Pro plan',
  expectationsTitle: 'What to expect',
  expectations: [
    {
      label: 'Plan',
      title: 'Pro plan required',
      body: 'API keys and MCP access are included with Pro.',
    },
    {
      label: 'Works with',
      title: 'Cursor, Claude Code, Windsurf, Lovable, and Bolt',
      body: 'Add the config or custom connector, then run checks from your building workflow.',
    },
    {
      label: 'Wait time',
      title: 'Checks may queue',
      body: 'When FixFlags is busy, your editor receives an estimated wait before the check starts.',
    },
    {
      label: 'URL support',
      title: 'Public URLs only',
      body: 'Live and preview URLs work. Localhost and private sites are not reachable yet.',
    },
  ],
  lovableBoltNote:
    'Lovable and Bolt support FixFlags through custom MCP connectors. You can also copy the exact builder prompt from any Flag.',
  tools: [
    { name: 'ff_check_and_plan', desc: 'Check a URL and return the report plus every ranked fix.' },
    { name: 'ff_get_check_status', desc: 'Check if a report is complete.' },
    { name: 'ff_get_report', desc: 'Get rubric summaries (scores, grades, status) and shareStatus. Use ff_get_rubric or ff_get_flag for fix prompts.' },
    {
      name: 'ff_get_rubric',
      desc: 'Get detailed flags + fix prompt for one rubric (Message, Experience, Reach).',
    },
    { name: 'ff_get_flag', desc: 'Get the fix prompt for a specific flag.' },
    { name: 'ff_get_all_fixes', desc: 'Get every unresolved Flag and fix prompt, ranked by launch impact.' },
    { name: 'ff_recheck_and_compare', desc: 'Run a fresh re-check and return the verification diff plus the next complete fix list.' },
    {
      name: 'ff_compare',
      desc: 'Compare two reports: see what improved, stayed the same, or regressed.',
    },
    {
      name: 'ff_list_recent_audits',
      desc: 'List recent reports with status, score, and key metadata.',
    },
    {
      name: 'ff_start_repo_scan',
      desc: 'Start a GitHub repository code scan for an allow-listed repo.',
    },
    {
      name: 'ff_list_repo_scans',
      desc: 'List recent GitHub repository checks and Flag counts.',
    },
    {
      name: 'ff_get_repo_scan',
      desc: 'Get a GitHub repository check and its code Flags.',
    },
    {
      name: 'ff_get_repo_finding',
      desc: 'Get a branch-ready fix task for one repository Flag.',
    },
    {
      name: 'generate-fix-prompt',
      desc: 'Generate a custom fix prompt from any problem description.',
    },
  ],
  configExamples: {
    claudeCode: `# ~/.claude/mcp.json
{
  "mcpServers": {
    "${BRAND.mcpServerKey}": {
      "url": "${SITE_URL}/api/mcp",
      "headers": {
        "Authorization": "Bearer ff_live_your_key_here"
      }
    }
  }
}`,
    cursor: `# .cursor/mcp.json
{
  "mcpServers": {
    "${BRAND.mcpServerKey}": {
      "url": "${SITE_URL}/api/mcp",
      "headers": {
        "Authorization": "Bearer ff_live_your_key_here"
      }
    }
  }
}`,
    windsurf: `# ~/.codeium/windsurf/mcp_config.json
{
  "mcpServers": {
    "${BRAND.mcpServerKey}": {
      "serverUrl": "${SITE_URL}/api/mcp",
      "headers": {
        "Authorization": "Bearer ff_live_your_key_here"
      }
    }
  }
}`,
  },
  configLabels: {
    claudeCode: 'Claude Code',
    cursor: 'Cursor',
    windsurf: 'Windsurf',
    lovable: 'Lovable',
    bolt: 'Bolt',
  },
} as const

export const PRODUCT_WATCH_COPY = {
  description: 'FixFlags re-checks this product on a schedule and emails you only when something regresses.',
  weekly: 'Weekly',
  daily: 'Daily',
  off: 'Off',
  proLink: 'Pro adds weekly watch',
  unavailable: 'Product Watch is unavailable until scheduling and email delivery are configured.',
  updateFailed: 'Could not update Product Watch.',
  loadFailed: 'Could not load Product Watch status.',
  successWeekly: 'Weekly Product Watch enabled.',
  successDaily: 'Daily Product Watch enabled.',
  successOff: 'Product Watch turned off.',
  nextRun: 'Next check',
  lastRun: 'Last successful check',
  lastAttempt: 'Last attempt',
  never: 'Not yet',
} as const
