/**
 * Canonical public MCP surface.
 *
 * Registration modules, documentation, and quality gates all consume these
 * entries so a module split cannot silently hide or rename a public tool.
 */
export const MCP_CONTRACT_VERSION = '1.0' as const

type McpToolTier = 'core' | 'optional' | 'protocol'

type McpToolDefinition = {
  name: string
  desc: string
  tier: McpToolTier
}

export const MCP_TOOLS = {
  checkAndPlan: {
    name: 'ff_check_and_plan',
    desc: 'Check a deployed URL and return its complete ranked Fix List plus a bounded Finish Plan. Validate each selected Flag against its evidence before changing product code.',
    tier: 'core',
  },
  getCheckStatus: {
    name: 'ff_get_check_status',
    desc: 'Check if a report is complete.',
    tier: 'core',
  },
  getReport: {
    name: 'ff_get_report',
    desc: 'Get rubric summaries, report status, and the complete Fix List.',
    tier: 'core',
  },
  getRubric: {
    name: 'ff_get_rubric',
    desc: 'Get detailed flags and fix prompts for one rubric.',
    tier: 'optional',
  },
  getFlag: {
    name: 'ff_get_flag',
    desc: 'Get the fix prompt for a specific Flag.',
    tier: 'core',
  },
  planModePrompt: {
    name: 'ff_plan_mode_prompt',
    desc: 'Get one plan-mode prompt containing every ranked fix.',
    tier: 'optional',
  },
  getProductContext: {
    name: 'ff_get_product_context',
    desc: 'Get Product Contract and Product Intelligence context.',
    tier: 'optional',
  },
  getAllFixes: {
    name: 'ff_get_all_fixes',
    desc: 'Get every unresolved Flag and fix prompt, ranked by launch impact.',
    tier: 'optional',
  },
  getCurrentFinishPlan: {
    name: 'ff_get_current_finish_plan',
    desc: 'Get the current one-to-three item Finish Plan and a prompt built only from those selected Flags.',
    tier: 'optional',
  },
  recheckAndCompare: {
    name: 'ff_recheck_and_compare',
    desc: 'After testing and deploying a product fix, run a fresh update review and return Fixed, Remaining, New, and Regressed Flags plus the complete Fix List and next Finish Plan.',
    tier: 'core',
  },
  compare: {
    name: 'ff_compare',
    desc: 'Compare two reports to see what improved, stayed the same, or regressed.',
    tier: 'optional',
  },
  generateFixPrompt: {
    name: 'generate-fix-prompt',
    desc: 'Generate a custom fix prompt from a problem description.',
    tier: 'optional',
  },
  listRecentAudits: {
    name: 'ff_list_recent_audits',
    desc: 'List recent audits with status, score, and key metadata.',
    tier: 'optional',
  },
  startRepoScan: {
    name: 'ff_start_repo_scan',
    desc: 'Start a GitHub repository code scan for an allow-listed repository.',
    tier: 'optional',
  },
  listRepoScans: {
    name: 'ff_list_repo_scans',
    desc: 'List recent GitHub repository scans and finding counts.',
    tier: 'optional',
  },
  getRepoScan: {
    name: 'ff_get_repo_scan',
    desc: 'Get a GitHub repository scan and its code findings.',
    tier: 'optional',
  },
  getRepoFinding: {
    name: 'ff_get_repo_finding',
    desc: 'Get a branch-ready fix task for one repository finding.',
    tier: 'optional',
  },
  markFixAttempted: {
    name: 'ff_mark_fix_attempted',
    desc: 'Record a builder attempt for a Flag, or intentionally reject it. Only a fresh FixFlags Review can verify the result.',
    tier: 'core',
  },
  getConnectionInfo: {
    name: 'ff_get_connection_info',
    desc: 'Inspect the FixFlags MCP contract, authenticated capabilities, and canonical Product Review workflow.',
    tier: 'protocol',
  },
} as const satisfies Record<string, McpToolDefinition>

export const MCP_TOOL_DEFINITIONS = Object.values(MCP_TOOLS)
export const MCP_CORE_TOOL_DEFINITIONS = MCP_TOOL_DEFINITIONS.filter(
  (tool) => tool.tier === 'core'
)
export const MCP_OPTIONAL_TOOL_DEFINITIONS = MCP_TOOL_DEFINITIONS.filter(
  (tool) => tool.tier === 'optional'
)

export function inspectMcpToolReadiness(toolNames: Iterable<string>) {
  const available = new Set(toolNames)
  const missingCore = MCP_CORE_TOOL_DEFINITIONS
    .map((tool) => tool.name)
    .filter((name) => !available.has(name))
  const optional = MCP_OPTIONAL_TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    available: available.has(tool.name),
  }))

  return {
    contractVersion: MCP_CONTRACT_VERSION,
    ready: missingCore.length === 0,
    missingCore,
    optional,
  }
}

export type McpToolName = (typeof MCP_TOOL_DEFINITIONS)[number]['name']
