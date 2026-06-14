import type { JudgeOutput } from '@/lib/audit/judge'
import type { DeterministicFinding } from '@/lib/audit/checks'
import { AREA_ORDER } from '@/lib/audit/constants'
import { verificationRuleForCheckId } from '@/lib/audit/verify-findings'

const POOR_GRADES = new Set(['B', 'C', 'D', 'F'])

function normalizeProblem(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function severityForGrade(grade: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (grade === 'F' || grade === 'D') return 'HIGH'
  if (grade === 'C') return 'MEDIUM'
  return 'LOW'
}

export function validateAndRepairJudgeOutput(
  output: JudgeOutput,
  deterministicFindings: DeterministicFinding[]
): JudgeOutput {
  const launchReadiness = output.launchReadiness ?? 'fix_first'
  const launchChecklist = output.launchChecklist ?? []

  const areas = [...output.areas]
  const areaNames = new Set(areas.map((a) => a.name))

  for (const name of AREA_ORDER) {
    if (!areaNames.has(name)) {
      areas.push({
        name,
        grade: 'A',
        status: 'EXCELLENT',
        summary: 'No significant issues detected in this area.',
        areaPrompt: `Review ${name} on this page and preserve current quality.`,
        score: name === 'PERFORMANCE' || name === 'ACCESSIBILITY' || name === 'SEO' ? 90 : null,
      })
    }
  }

  const newFindings = [...output.newFindings]
  const enrichments = [...output.enrichments]

  for (const area of areas) {
    const detInArea = deterministicFindings.filter((f) => f.area === area.name)
    const aiInArea = newFindings.filter((f) => f.area === area.name)
    const totalFindings = detInArea.length + aiInArea.length

    if (POOR_GRADES.has(area.grade) && totalFindings === 0 && area.summary.trim()) {
      newFindings.push({
        area: area.name,
        severity: severityForGrade(area.grade),
        problem: area.summary.split('.')[0] ?? area.summary,
        evidence: area.summary,
        whyItMatters: `This ${area.name.toLowerCase()} issue affects how visitors experience your page.`,
        fix: area.areaPrompt,
        confidence: 0.75,
        verificationRule: `Re-audit ${area.name.toLowerCase()} after applying fixes and confirm the grade improves.`,
      })
    }
  }

  for (const finding of deterministicFindings) {
    const hasEnrichment = enrichments.some((e) => e.checkId === finding.checkId)
    if (!hasEnrichment) {
      enrichments.push({
        checkId: finding.checkId,
        whyItMatters: `This issue affects ${finding.area.toLowerCase()} quality and launch readiness.`,
        agentPrompt: finding.fix,
        verificationRule:
          verificationRuleForCheckId(finding.checkId) ??
          `Confirm ${finding.checkId} no longer applies after your fix.`,
      })
    }
  }

  return {
    ...output,
    launchReadiness,
    launchChecklist,
    areas,
    newFindings,
    enrichments,
  }
}

export function buildAiFindingMatchKey(problem: string, area: string): string {
  return `${area}::${normalizeProblem(problem)}`
}
