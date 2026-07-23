/**
 * Canonical public MCP surface.
 *
 * Registration modules, documentation, and quality gates all consume these
 * entries so a module split cannot silently hide or rename a public tool.
 */
export const MCP_TOOLS = {
  checkAndPlan: {
    name: 'ff_check_and_plan',
    desc: 'Check a URL and return the report plus every ranked fix.',
  },
  getCheckStatus: {
    name: 'ff_get_check_status',
    desc: 'Check if a report is complete.',
  },
  getReport: {
    name: 'ff_get_report',
    desc: 'Get rubric summaries, report status, and the complete Fix List.',
  },
  getRubric: {
    name: 'ff_get_rubric',
    desc: 'Get detailed flags and fix prompts for one rubric.',
  },
  getFlag: {
    name: 'ff_get_flag',
    desc: 'Get the fix prompt for a specific Flag.',
  },
  planModePrompt: {
    name: 'ff_plan_mode_prompt',
    desc: 'Get one plan-mode prompt containing every ranked fix.',
  },
  getProductContext: {
    name: 'ff_get_product_context',
    desc: 'Get Product Contract and Product Intelligence context.',
  },
  getAllFixes: {
    name: 'ff_get_all_fixes',
    desc: 'Get every unresolved Flag and fix prompt, ranked by launch impact.',
  },
  getCurrentFinishPlan: {
    name: 'ff_get_current_finish_plan',
    desc: 'Deprecated: get the legacy three-item quick plan.',
  },
  recheckAndCompare: {
    name: 'ff_recheck_and_compare',
    desc: 'Run a fresh re-check and return its diff plus the next complete Fix List.',
  },
  compare: {
    name: 'ff_compare',
    desc: 'Compare two reports to see what improved, stayed the same, or regressed.',
  },
  generateFixPrompt: {
    name: 'generate-fix-prompt',
    desc: 'Generate a custom fix prompt from a problem description.',
  },
  listRecentAudits: {
    name: 'ff_list_recent_audits',
    desc: 'List recent audits with status, score, and key metadata.',
  },
  startRepoScan: {
    name: 'ff_start_repo_scan',
    desc: 'Start a GitHub repository code scan for an allow-listed repository.',
  },
  listRepoScans: {
    name: 'ff_list_repo_scans',
    desc: 'List recent GitHub repository scans and finding counts.',
  },
  getRepoScan: {
    name: 'ff_get_repo_scan',
    desc: 'Get a GitHub repository scan and its code findings.',
  },
  getRepoFinding: {
    name: 'ff_get_repo_finding',
    desc: 'Get a branch-ready fix task for one repository finding.',
  },
} as const

export const MCP_TOOL_DEFINITIONS = Object.values(MCP_TOOLS)
export type McpToolName = (typeof MCP_TOOL_DEFINITIONS)[number]['name']
