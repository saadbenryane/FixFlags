/**
 * Canonical public MCP surface.
 *
 * Registration modules, documentation, and quality gates all consume these
 * entries so a module split cannot silently hide or rename a public tool.
 */
export const MCP_TOOLS = {
  checkAndPlan: {
    name: 'ff_check_and_plan',
    desc: 'Check a deployed URL and return its complete ranked Fix List plus a bounded Finish Plan. Validate each selected Flag against its evidence before changing product code.',
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
    desc: 'Get the current one-to-three item Finish Plan and a prompt built only from those selected Flags.',
  },
  recheckAndCompare: {
    name: 'ff_recheck_and_compare',
    desc: 'After testing and deploying a product fix, run a fresh update review and return Fixed, Remaining, New, and Regressed Flags plus the complete Fix List and next Finish Plan.',
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
  markFixAttempted: {
    name: 'ff_mark_fix_attempted',
    desc: 'Mark a Flag as fixed or ignored with an optional comment.',
  },
} as const

export const MCP_TOOL_DEFINITIONS = Object.values(MCP_TOOLS)
export type McpToolName = (typeof MCP_TOOL_DEFINITIONS)[number]['name']
