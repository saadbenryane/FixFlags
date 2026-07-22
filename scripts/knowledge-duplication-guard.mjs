#!/usr/bin/env node
/**
 * Knowledge Duplication Guard
 *
 * Scans markdown files for substantive content that belongs in a canonical source
 * but appears duplicated in non-canonical locations. Cross-references and brief
 * mentions are allowed; full tables, numbered step lists, and detailed definitions
 * are flagged.
 *
 * Exit code 1 = violations found. Exit code 0 = clean.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = process.cwd()
const SKIP = new Set([
  'node_modules', '.next', 'dist', 'fixflags-cli',
  '.git', '.agents', '.cursor', '.ui-craft', 'ide-integrations',
])

// ---------------------------------------------------------------------------
// Canonical rules: each rule defines a concept that should live in ONE file.
// `pattern` matches the substantive content to detect.
// `canonical` is the one file where it is allowed.
// `description` explains what the check catches.
// `allowed` is an optional list of files/paths where matches are also permitted.
// ---------------------------------------------------------------------------

const RULES = [
  // --- Pricing tiers table (prices + plan names together) ---
  {
    id: 'pricing-tiers',
    description: 'Pricing tiers with dollar amounts (canonical: knowledge/strategy.md)',
    canonical: 'knowledge/strategy.md',
    pattern: /\$29\/mo.*?\$99\/mo|\$99\/mo.*?\$29\/mo|\$29.*?BUILDER.*?\$99.*?TEAM|\$99.*?TEAM.*?\$29.*?BUILDER/gis,
    allowed: [
      'PRODUCT.md',
      'AGENTS.md',
      'ARCHITECTURE.md',
      'docs/stripe-setup.md',
      'docs/year-1-operating-plan.md',
      'lib/billing/codemap.md',
    ],
  },

  // --- Core loop numbered steps (1-7) ---
  {
    id: 'core-loop-steps',
    description: 'Full 7-step core loop sequence (canonical: PRODUCT.md)',
    canonical: 'PRODUCT.md',
    pattern: /1\.\s+User pastes a URL[\s\S]*?7\.\s+User sees before\/after/g,
    allowed: [],
  },

  // --- Audit pipeline stages (arrow chain) ---
  {
    id: 'pipeline-stages',
    description: 'Full pipeline stage chain (canonical: docs/audit-pipeline.md)',
    canonical: 'docs/audit-pipeline.md',
    pattern: /QUEUED\s*(→|->)\s*CAPTURING\s*(→|->)\s*CHECKING\s*(→|->)\s*JUDGING/g,
    allowed: [
      'ARCHITECTURE.md',
      'AGENTS.md',
      'CODEMAP.md',
      'QUALITY.md',
      'test-strategy.md',
      'lib/audit/codemap.md',
      '.opencode/skills/fixflags-audit-pipeline.md',
    ],
  },

  // --- Rubric definitions (all three rubrics with descriptions) ---
  {
    id: 'rubric-definitions',
    description: 'Full rubric definitions with all three descriptions (canonical: PRODUCT.md)',
    canonical: 'PRODUCT.md',
    pattern: /\*\*Message:\*\*\s+Headline clarity[\s\S]*?\*\*Reach:\*\*\s+SEO metadata/g,
    allowed: ['docs/brand-positioning.md'],
  },

  // --- "What we don't ship" list ---
  {
    id: 'what-we-dont-ship',
    description: '"What we do not ship" list with bullet items (canonical: PRODUCT.md)',
    canonical: 'PRODUCT.md',
    pattern: /##\s*What We Do Not Ship[\s\S]*?(?=##|\n---|\Z)/g,
    allowed: ['docs/business-model.md', 'docs/offering.md'],
  },

  // --- Target audience detailed descriptions ---
  {
    id: 'target-audience',
    description: 'Detailed target audience descriptions with primary/secondary/later/anti-target (canonical: PRODUCT.md)',
    canonical: 'PRODUCT.md',
    pattern: /\*\*Primary:\*\*\s+AI-first founders[\s\S]*?\*\*Anti-target:\*\*\s+Enterprise/g,
    allowed: ['docs/brand-positioning.md'],
  },

  // --- Launch gates list ---
  {
    id: 'launch-gates',
    description: 'Launch gates list (canonical: PRODUCT.md)',
    canonical: 'PRODUCT.md',
    pattern: /## Launch gates[\s\S]*?5\.\s+Console has no errors/g,
    allowed: [],
  },

  // --- Competitor comparison table ---
  {
    id: 'competitor-table',
    description: 'Competitor comparison table (canonical: knowledge/market.md)',
    canonical: 'knowledge/market.md',
    pattern: /\| Tool \| FixFlags Advantage \|[\s\S]*?\| (Lighthouse|accessiBe) \|/g,
    allowed: ['docs/brand-positioning.md'],
  },

  // --- Voice rules (sentence rules) ---
  {
    id: 'voice-rules',
    description: 'Sentence rules list (canonical: docs/voice-and-copy.md)',
    canonical: 'docs/voice-and-copy.md',
    pattern: /## Sentence rules[\s\S]*?No em dashes anywhere/g,
    allowed: ['SOUL.md'],
  },

  // --- Design typography table ---
  {
    id: 'design-typography',
    description: 'Typography table (canonical: DESIGN.md)',
    canonical: 'DESIGN.md',
    pattern: /\| Display.*?Fraunces[\s\S]*?\| Score numbers \| IBM Plex Mono/g,
    allowed: [],
  },

  // --- Design color system ---
  {
    id: 'design-color',
    description: 'Color system 60/30/10 table (canonical: DESIGN.md)',
    canonical: 'DESIGN.md',
    pattern: /\| 60% \| Background[\s\S]*?\| 10% \| Brand orange/g,
    allowed: [],
  },

  // --- Verification matrix (three tiers) ---
  {
    id: 'verification-tiers',
    description: 'Verification matrix three tiers (canonical: QUALITY.md)',
    canonical: 'QUALITY.md',
    pattern: /\| Tier \| Question \| Current readiness[\s\S]*?\| Touch \| Does the product/g,
    allowed: [],
  },

  // --- Pricing philosophy ---
  {
    id: 'pricing-philosophy',
    description: 'Pricing philosophy bullets (canonical: knowledge/strategy.md)',
    canonical: 'knowledge/strategy.md',
    pattern: /Entry price low enough to convert[\s\S]*?No founding offers[\s\S]*?\$29 is the real price/g,
    allowed: ['docs/business-model.md'],
  },

  // --- Re-check invariants ---
  {
    id: 'recheck-invariants',
    description: 'Re-check invariants about always monitoringMode FULL and fresh capture (canonical: docs/audit-pipeline.md)',
    canonical: 'docs/audit-pipeline.md',
    pattern: /Always `monitoringMode: FULL`[\s\S]*?Fresh capture[\s\S]*?No usage charge/g,
    allowed: ['AGENTS.md'],
  },

  // --- Degradation matrix ---
  {
    id: 'degradation-matrix',
    description: 'Degradation matrix table (canonical: docs/audit-pipeline.md)',
    canonical: 'docs/audit-pipeline.md',
    pattern: /\| Trigger \| Outcome \| User sees \|[\s\S]*?\| R2 missing.*?FAILED/g,
    allowed: [],
  },

  // --- Security trust boundaries ---
  {
    id: 'trust-boundaries',
    description: 'Trust boundaries list (canonical: SECURITY.md)',
    canonical: 'SECURITY.md',
    pattern: /## Trust boundaries[\s\S]*?5\.\s+GitHub API/g,
    allowed: ['ARCHITECTURE.md'],
  },

  // --- Anonymous wedge description ---
  {
    id: 'anonymous-wedge',
    description: 'Anonymous wedge description with "1 teaser scan" (canonical: PRODUCT.md)',
    canonical: 'PRODUCT.md',
    pattern: /Exactly\s*\*\*1\*\*\s+teaser scan without account/g,
    allowed: ['knowledge/product.md', 'AGENTS.md'],
  },

  // --- Support channels ---
  {
    id: 'support-channels',
    description: 'Support channels list (canonical: PRODUCT.md)',
    canonical: 'PRODUCT.md',
    pattern: /## Support[\s\S]*?Do \*\*not\*\* market priority/g,
    allowed: [],
  },

  // --- Feature philosophy ---
  {
    id: 'feature-philosophy',
    description: 'Feature philosophy bullets (canonical: docs/offering.md)',
    canonical: 'docs/offering.md',
    pattern: /## Feature Philosophy[\s\S]*?Build for quality, not feature count/g,
    allowed: [],
  },
]

// ---------------------------------------------------------------------------
// Scan helpers
// ---------------------------------------------------------------------------

function walkMarkdown(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      walkMarkdown(p, files)
    } else if (extname(name) === '.md') {
      files.push(p)
    }
  }
  return files
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const allFiles = walkMarkdown(ROOT)
const violations = []

for (const filePath of allFiles) {
  const rel = relative(ROOT, filePath)
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    continue
  }

  for (const rule of RULES) {
    if (rel === rule.canonical) continue
    if (rule.allowed && rule.allowed.includes(rel)) continue

    const matches = content.match(rule.pattern)
    if (matches && matches.length > 0) {
      const firstMatch = matches[0]
      const idx = content.indexOf(firstMatch)
      const lineNumber = content.slice(0, idx).split('\n').length

      violations.push({
        file: rel,
        rule: rule.id,
        description: rule.description,
        canonical: rule.canonical,
        line: lineNumber,
        matchPreview: firstMatch.slice(0, 120).replace(/\n/g, ' '),
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (violations.length === 0) {
  console.log('Knowledge duplication guard passed. No duplicated concepts found.')
  process.exit(0)
}

console.error(
  `Knowledge duplication guard failed — ${violations.length} duplicated concept(s) found:\n`
)

const byFile = {}
for (const v of violations) {
  if (!byFile[v.file]) byFile[v.file] = []
  byFile[v.file].push(v)
}

for (const [file, viols] of Object.entries(byFile)) {
  console.error(`  ${file}`)
  for (const v of viols) {
    console.error(`    L${v.line}: [${v.rule}] ${v.description}`)
    console.error(`      canonical: ${v.canonical}`)
    console.error(`      match: "${v.matchPreview}..."`)
  }
  console.error('')
}

console.error(
  'Move duplicated content to its canonical source and replace with a cross-reference.\n' +
  'See CANONICAL-SOURCES.md for the canonical source of every concept.'
)

process.exit(1)
